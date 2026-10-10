import 'server-only';
import { pool, query } from '@/lib/db';
import { formatUtc } from '@/lib/audit-core';
import {
    DEFAULT_TIMEZONE, addDays, daysBetween, eachDay, isDay, isTime, localDay, normTime, shiftInterval, weekStart, zonedToUtc, type Interval,
} from '@/lib/hr-time';
import {
    countLeaveDays, evaluateDay, leaveClashes, matchShift, overlaps, type DayPart, type DayResult, type Punch, type Shift,
} from '@/lib/hr-rules';

/** Thrown for a rule the caller broke; the route turns it into a 4xx with this message. */
export class HrError extends Error {
    constructor(public status: number, message: string) { super(message); }
}

export const STAFF_ROLES = ['DOCTOR', 'PHARMACIST', 'LAB_ASSISTANT', 'RECEPTIONIST', 'ADMIN', 'HR_MANAGER'] as const;
const STAFF_SQL = STAFF_ROLES.map((r) => `'${r}'`).join(',');

// SQL fragments that hand dates and times back as plain strings (mysql2 would otherwise build Date objects in server time)
const DAY = (c: string) => `DATE_FORMAT(${c}, '%Y-%m-%d')`;
const HM = (c: string) => `TIME_FORMAT(${c}, '%H:%i')`;
const UTC = (c: string) => `DATE_FORMAT(${c}, '%Y-%m-%dT%H:%i:%s.%fZ')`;

// ------------------------------------------------------------------------------------------------- settings

export interface HrSettings {
    timezone: string;
    graceMinutes: number;
    earlyWindowMinutes: number;
    missingClockOutHours: number;
}

export async function loadSettings(): Promise<HrSettings> {
    let rows: { setting_key: string; setting_value: string }[] = [];
    try {
        rows = await query('SELECT setting_key, setting_value FROM hr_settings');
    } catch (err: any) {
        if (err?.errno !== 1146) throw err;   // table missing: use defaults until 20_hr.sql is run
    }
    const m = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
    const num = (key: string, fallback: number) => (Number.isFinite(Number(m[key])) && m[key] !== undefined ? Number(m[key]) : fallback);
    return {
        timezone: m.timezone || DEFAULT_TIMEZONE,
        graceMinutes: num('grace_minutes', 10),
        earlyWindowMinutes: num('early_window_minutes', 180),
        missingClockOutHours: num('missing_clock_out_hours', 16),
    };
}

// ------------------------------------------------------------------------------------------------- shifts

export interface ShiftRow { id: number; user_id: number; shift_date: string; start_time: string; end_time: string; label: string | null }

export async function loadShifts(userIds: number[] | null, from: string, to: string): Promise<ShiftRow[]> {
    const where = userIds ? `AND user_id IN (${userIds.map(() => '?').join(',') || 'NULL'})` : '';
    return query<ShiftRow[]>(
        `SELECT id, user_id, ${DAY('shift_date')} AS shift_date, ${HM('start_time')} AS start_time, ${HM('end_time')} AS end_time, label
         FROM shift_assignments WHERE shift_date BETWEEN ? AND ? ${where} ORDER BY shift_date, start_time`,
        [from, to, ...(userIds ?? [])]);
}

export const toShift = (r: ShiftRow, tz: string): Shift => ({ id: r.id, label: r.label, ...shiftInterval(r.shift_date, r.start_time, r.end_time, tz) });

export async function loadHolidays(from: string, to: string): Promise<Map<string, string>> {
    const rows = await query<{ d: string; name: string }[]>(`SELECT ${DAY('holiday_date')} AS d, name FROM public_holidays WHERE holiday_date BETWEEN ? AND ?`, [from, to]);
    return new Map(rows.map((r) => [r.d, r.name]));
}

export interface LeaveRow { id: number; user_id: number; leave_type_id: number; type_name: string; start_date: string; end_date: string; day_part: DayPart; days: number; status: string }

export async function loadLeave(userIds: number[] | null, from: string, to: string, statuses: string[]): Promise<LeaveRow[]> {
    const where = userIds ? `AND r.user_id IN (${userIds.map(() => '?').join(',') || 'NULL'})` : '';
    return query<LeaveRow[]>(
        `SELECT r.id, r.user_id, r.leave_type_id, t.name AS type_name, ${DAY('r.start_date')} AS start_date, ${DAY('r.end_date')} AS end_date, r.day_part, r.days, r.status
         FROM leave_requests r JOIN leave_types t ON t.id = r.leave_type_id
         WHERE r.status IN (${statuses.map(() => '?').join(',')}) AND r.start_date <= ? AND r.end_date >= ? ${where}`,
        [...statuses, to, from, ...(userIds ?? [])]);
}

export interface ShiftRequest { userIds: number[]; dates: string[]; times: { start: string; end: string; label?: string | null }[] }
export interface Skipped { userId: number; date: string; start?: string; end?: string; reason: string }

/** Validates the times of one request (shared by create and the form). */
export function checkShiftTimes(times: ShiftRequest['times']): void {
    if (times.length === 0 || times.length > 8) throw new HrError(400, 'Add between 1 and 8 shifts');
    const intervals: Interval[] = [];
    for (const t of times) {
        if (!isTime(t.start) || !isTime(t.end)) throw new HrError(400, 'Use valid start and finish times');
        if (normTime(t.start) === normTime(t.end)) throw new HrError(400, 'A shift cannot start and finish at the same time');
        const iv = shiftInterval('2026-01-01', t.start, t.end, 'UTC');
        if ((iv.end.getTime() - iv.start.getTime()) > 16 * 3_600_000) throw new HrError(400, 'A single shift cannot be longer than 16 hours');
        if (intervals.some((o) => overlaps(o, iv))) throw new HrError(400, 'The shifts you added overlap each other');
        intervals.push(iv);
    }
}

/**
 * Adds shifts for several people on several days. Anything that cannot be added (the person is on approved leave, or the
 * shift would overlap one they already have) is skipped and reported, and the rest are created.
 */
export async function createShifts(actorId: number, req: ShiftRequest, tz: string): Promise<{ created: number; skipped: Skipped[] }> {
    checkShiftTimes(req.times);
    const dates = [...new Set(req.dates)].sort();
    if (dates.length === 0 || dates.length > 366 || !dates.every(isDay)) throw new HrError(400, 'Choose valid dates (up to a year at a time)');
    const userIds = [...new Set(req.userIds)];
    if (userIds.length === 0 || userIds.length > 300) throw new HrError(400, 'Choose between 1 and 300 people');
    if (userIds.length * dates.length * req.times.length > 5000) throw new HrError(400, 'That is too many shifts at once; split it up');

    const valid = await query<{ id: number }[]>(
        `SELECT u.id FROM users u LEFT JOIN employee_profiles p ON p.user_id = u.id
         WHERE u.id IN (${userIds.map(() => '?').join(',')}) AND u.role IN (${STAFF_SQL}) AND COALESCE(p.status, 'ACTIVE') = 'ACTIVE'`, userIds);
    const okIds = new Set(valid.map((v) => v.id));

    const rows: { userId: number; date: string; start: string; end: string; label: string | null }[] = [];
    for (const u of userIds) for (const d of dates) for (const t of req.times) rows.push({ userId: u, date: d, start: normTime(t.start), end: normTime(t.end), label: t.label?.trim().slice(0, 60) || null });
    return insertShiftsChecked(actorId, rows, okIds, tz);
}

async function insertShiftsChecked(
    actorId: number, rows: { userId: number; date: string; start: string; end: string; label: string | null }[], allowedUsers: Set<number>, tz: string,
): Promise<{ created: number; skipped: Skipped[] }> {
    const skipped: Skipped[] = [];
    if (rows.length === 0) return { created: 0, skipped };
    const dates = rows.map((r) => r.date).sort();
    const from = addDays(dates[0], -1), to = dates[dates.length - 1];
    const users = [...new Set(rows.map((r) => r.userId))];

    const existing = await loadShifts(users, from, to);
    const taken = new Map<number, Interval[]>();
    for (const e of existing) (taken.get(e.user_id) ?? taken.set(e.user_id, []).get(e.user_id)!).push(toShift(e, tz));
    const leave = await loadLeave(users, dates[0], to, ['APPROVED']);

    const toInsert: typeof rows = [];
    for (const r of rows) {
        const base = { userId: r.userId, date: r.date, start: r.start, end: r.end };
        if (!allowedUsers.has(r.userId)) { skipped.push({ ...base, reason: 'Not an active staff member' }); continue; }
        if (leave.some((l) => l.user_id === r.userId && l.day_part === 'FULL' && l.start_date <= r.date && l.end_date >= r.date)) {
            skipped.push({ ...base, reason: 'On approved leave' }); continue;
        }
        const iv = shiftInterval(r.date, r.start, r.end, tz);
        const mine = taken.get(r.userId) ?? [];
        if (mine.some((o) => overlaps(o, iv))) { skipped.push({ ...base, reason: 'Overlaps a shift they already have' }); continue; }
        mine.push(iv);
        taken.set(r.userId, mine);
        toInsert.push(r);
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        for (let i = 0; i < toInsert.length; i += 500) {
            const chunk = toInsert.slice(i, i + 500);
            await conn.query(
                'INSERT INTO shift_assignments (user_id, shift_date, start_time, end_time, label, created_by) VALUES ?',
                [chunk.map((r) => [r.userId, r.date, r.start, r.end, r.label, actorId])]);
        }
        await conn.commit();
    } catch (err) {
        await conn.rollback().catch(() => {});
        throw err;
    } finally {
        conn.release();
    }
    return { created: toInsert.length, skipped };
}

/** Repeats one week of the roster onto another. */
export async function copyWeek(actorId: number, fromMonday: string, toMonday: string, tz: string): Promise<{ created: number; skipped: Skipped[] }> {
    if (!isDay(fromMonday) || !isDay(toMonday) || weekStart(fromMonday) !== fromMonday || weekStart(toMonday) !== toMonday) throw new HrError(400, 'Choose two weeks');
    if (fromMonday === toMonday) throw new HrError(400, 'Choose a different week to copy to');
    const source = await loadShifts(null, fromMonday, addDays(fromMonday, 6));
    const offset = daysBetween(fromMonday, toMonday);
    const rows = source.map((s) => ({ userId: s.user_id, date: addDays(s.shift_date, offset), start: s.start_time, end: s.end_time, label: s.label }));
    const valid = await query<{ id: number }[]>(`SELECT u.id FROM users u LEFT JOIN employee_profiles p ON p.user_id = u.id WHERE u.role IN (${STAFF_SQL}) AND COALESCE(p.status, 'ACTIVE') = 'ACTIVE'`);
    return insertShiftsChecked(actorId, rows, new Set(valid.map((v) => v.id)), tz);
}

// ------------------------------------------------------------------------------------------------- attendance

export interface PunchRow { id: number; user_id: number; work_date: string; shift_id: number | null; clock_in: string; clock_out: string | null; source: string; note: string | null }

export async function loadPunches(userIds: number[] | null, from: string, to: string): Promise<PunchRow[]> {
    const where = userIds ? `AND user_id IN (${userIds.map(() => '?').join(',') || 'NULL'})` : '';
    return query<PunchRow[]>(
        `SELECT id, user_id, ${DAY('work_date')} AS work_date, shift_id, ${UTC('clock_in')} AS clock_in, ${UTC('clock_out')} AS clock_out, source, note
         FROM attendance_records WHERE work_date BETWEEN ? AND ? ${where} ORDER BY clock_in`, [from, to, ...(userIds ?? [])]);
}

export interface DayDetail extends DayResult {
    holidayName: string | null;
    leaveType: string | null;
    shifts: { id: number; start: string; end: string; label: string | null }[];
    punches: { id: number; shiftId: number | null; clockIn: string; clockOut: string | null; source: string; note: string | null }[];
}

/** Every day in the range for each person, worked out from the roster, the punches, leave and holidays. */
export async function evaluateRange(userIds: number[], from: string, to: string, settings: HrSettings, now = new Date()): Promise<Map<number, DayDetail[]>> {
    const out = new Map<number, DayDetail[]>();
    if (userIds.length === 0) return out;
    const [shiftRows, punchRows, holidays, leave] = await Promise.all([
        loadShifts(userIds, from, to), loadPunches(userIds, from, to), loadHolidays(from, to), loadLeave(userIds, from, to, ['APPROVED']),
    ]);
    for (const uid of userIds) {
        const days: DayDetail[] = [];
        for (const day of eachDay(from, to)) {
            const myShifts = shiftRows.filter((s) => s.user_id === uid && s.shift_date === day);
            const shifts = myShifts.map((s) => toShift(s, settings.timezone));
            const myPunches = punchRows.filter((p) => p.user_id === uid && p.work_date === day);
            const punches: Punch[] = myPunches.map((p) => ({ id: p.id, shiftId: p.shift_id, clockIn: new Date(p.clock_in), clockOut: p.clock_out ? new Date(p.clock_out) : null }));
            const onLeave = leave.find((l) => l.user_id === uid && l.start_date <= day && l.end_date >= day);
            const result = evaluateDay({
                day, shifts, punches, graceMinutes: settings.graceMinutes, isHoliday: holidays.has(day), onLeave: Boolean(onLeave),
                now, missingClockOutHours: settings.missingClockOutHours,
            });
            days.push({
                ...result, holidayName: holidays.get(day) ?? null, leaveType: onLeave?.type_name ?? null,
                shifts: myShifts.map((s) => ({ id: s.id, start: s.start_time, end: s.end_time, label: s.label })),
                punches: myPunches.map((p) => ({ id: p.id, shiftId: p.shift_id, clockIn: p.clock_in, clockOut: p.clock_out, source: p.source, note: p.note })),
            });
        }
        out.set(uid, days);
    }
    return out;
}

async function openPunch(conn: { execute: (sql: string, p?: any[]) => Promise<any> }, userId: number) {
    const [rows]: any = await conn.execute(
        `SELECT id, ${UTC('clock_in')} AS clock_in, shift_id FROM attendance_records WHERE user_id = ? AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1`, [userId]);
    return rows[0] as { id: number; clock_in: string; shift_id: number | null } | undefined;
}

export interface ClockResult { recordId: number; at: string; workDate: string; shiftId: number | null; lateMinutes?: number; unscheduled?: boolean; early?: boolean; workedMinutes?: number }

/** Clock in. The time is the server's. One open session at a time; anyone can clock in at any time, and the result says if it was early, late or unscheduled. */
export async function clockIn(userId: number, ip: string | null, now = new Date()): Promise<ClockResult> {
    const settings = await loadSettings();
    const tz = settings.timezone;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.execute('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);   // serialises a double click

        const open = await openPunch(conn, userId);
        if (open && (now.getTime() - new Date(open.clock_in).getTime()) / 3_600_000 <= settings.missingClockOutHours) {
            throw new HrError(409, 'You are already clocked in. Clock out first.');
        }

        const today = localDay(now, tz);
        const shiftRows = await loadShifts([userId], addDays(today, -1), addDays(today, 1));
        const shifts = shiftRows.map((s) => toShift(s, tz));
        // Arriving after a shift has finished is not being late for it: only shifts still running or yet to start can match a clock-in
        const matched = matchShift(now, shifts.filter((s) => s.end > now), settings.earlyWindowMinutes);
        const matchedRow = matched ? shiftRows.find((r) => r.id === matched.id)! : null;
        const workDate = matchedRow ? matchedRow.shift_date : today;

        const [res]: any = await conn.execute(
            `INSERT INTO attendance_records (user_id, work_date, shift_id, clock_in, source, in_ip) VALUES (?, ?, ?, ?, 'SELF', ?)`,
            [userId, workDate, matched?.id ?? null, formatUtc(now), ip]);
        await conn.commit();

        const late = matched ? Math.round((now.getTime() - matched.start.getTime()) / 60_000) : 0;
        return {
            recordId: res.insertId, at: now.toISOString(), workDate, shiftId: matched?.id ?? null,
            lateMinutes: late > settings.graceMinutes ? late : 0, unscheduled: !matched,
            early: Boolean(matched) && late < -settings.graceMinutes,
        };
    } catch (err) {
        await conn.rollback().catch(() => {});
        throw err;
    } finally {
        conn.release();
    }
}

export async function clockOut(userId: number, ip: string | null, now = new Date()): Promise<ClockResult> {
    const settings = await loadSettings();
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.execute('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
        const open = await openPunch(conn, userId);
        if (!open) throw new HrError(409, 'You are not clocked in.');
        if ((now.getTime() - new Date(open.clock_in).getTime()) / 3_600_000 > settings.missingClockOutHours) {
            throw new HrError(409, 'This session has been open too long to close. Ask for a correction instead.');
        }
        await conn.execute('UPDATE attendance_records SET clock_out = ?, out_ip = ? WHERE id = ?', [formatUtc(now), ip, open.id]);
        await conn.commit();
        const worked = Math.round((now.getTime() - new Date(open.clock_in).getTime()) / 60_000);
        return { recordId: open.id, at: now.toISOString(), workDate: '', shiftId: open.shift_id, workedMinutes: worked };
    } catch (err) {
        await conn.rollback().catch(() => {});
        throw err;
    } finally {
        conn.release();
    }
}

/** Everything the "Today" card needs. */
export async function todayView(userId: number, now = new Date()) {
    const settings = await loadSettings();
    const today = localDay(now, settings.timezone);
    const days = (await evaluateRange([userId], addDays(today, -1), today, settings, now)).get(userId)!;
    const open = await openPunch(pool as any, userId).catch(() => undefined);
    const upcoming = await loadShifts([userId], today, addDays(today, 14));
    const lastDay = days[days.length - 1];
    return {
        timezone: settings.timezone, graceMinutes: settings.graceMinutes, today,
        todayShifts: lastDay.shifts, todayStatus: lastDay.status,
        yesterdayShifts: days[0].shifts,   // an overnight shift that began yesterday may still be running
        open: open ? { recordId: open.id, since: open.clock_in, shiftId: open.shift_id } : null,
        punchesToday: lastDay.punches,
        holidayName: lastDay.holidayName, leaveType: lastDay.leaveType,
        upcomingShifts: upcoming.map((s) => ({ id: s.id, date: s.shift_date, start: s.start_time, end: s.end_time, label: s.label })),
    };
}

export interface PunchEdit { userId: number; workDate: string; clockInTime: string; clockOutTime: string | null }

/** Turns local clock times on a work date into UTC instants (a finish at or before the start means the next day). */
export function punchInstants(workDate: string, inTime: string, outTime: string | null, tz: string): { clockIn: Date; clockOut: Date | null } {
    if (!isDay(workDate) || !isTime(inTime) || (outTime !== null && !isTime(outTime))) throw new HrError(400, 'Use a valid date and times');
    const clockIn = zonedToUtc(workDate, inTime, tz);
    let clockOut: Date | null = null;
    if (outTime !== null) {
        clockOut = zonedToUtc(workDate, outTime, tz);
        if (clockOut.getTime() <= clockIn.getTime()) clockOut = zonedToUtc(addDays(workDate, 1), outTime, tz);
        if (clockOut.getTime() - clockIn.getTime() > 24 * 3_600_000) throw new HrError(400, 'A session cannot be longer than 24 hours');
    }
    return { clockIn, clockOut };
}

/** Creates or changes a punch (HR edit, or an approved correction). Refuses a session that overlaps another one. */
export async function savePunch(actorId: number, source: 'CORRECTION' | 'HR', edit: PunchEdit & { recordId?: number | null; note?: string | null }): Promise<number> {
    const settings = await loadSettings();
    const { clockIn, clockOut } = punchInstants(edit.workDate, edit.clockInTime, edit.clockOutTime, settings.timezone);
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.execute('SELECT id FROM users WHERE id = ? FOR UPDATE', [edit.userId]);
        const [others]: any = await conn.execute(
            `SELECT id, ${UTC('clock_in')} AS clock_in, ${UTC('clock_out')} AS clock_out FROM attendance_records
             WHERE user_id = ? AND work_date BETWEEN ? AND ? AND id <> ?`, [edit.userId, addDays(edit.workDate, -1), addDays(edit.workDate, 1), edit.recordId ?? 0]);
        const mine: Interval = { start: clockIn, end: clockOut ?? new Date(clockIn.getTime() + 60_000) };
        for (const o of others as { clock_in: string; clock_out: string | null }[]) {
            const iv: Interval = { start: new Date(o.clock_in), end: o.clock_out ? new Date(o.clock_out) : new Date(new Date(o.clock_in).getTime() + 60_000) };
            if (overlaps(mine, iv)) throw new HrError(409, 'That overlaps another clock-in on the same day.');
        }
        const shifts = (await loadShifts([edit.userId], addDays(edit.workDate, -1), addDays(edit.workDate, 1))).map((s) => ({ row: s, shift: toShift(s, settings.timezone) }));
        const matched = matchShift(clockIn, shifts.map((s) => s.shift), settings.earlyWindowMinutes);
        let id = edit.recordId ?? 0;
        if (edit.recordId) {
            const [upd]: any = await conn.execute(
                `UPDATE attendance_records SET work_date = ?, shift_id = ?, clock_in = ?, clock_out = ?, source = ?, note = ?, created_by = ? WHERE id = ? AND user_id = ?`,
                [edit.workDate, matched?.id ?? null, formatUtc(clockIn), clockOut ? formatUtc(clockOut) : null, source, edit.note ?? null, actorId, edit.recordId, edit.userId]);
            if (upd.affectedRows === 0) throw new HrError(404, 'That record was not found');
        } else {
            const [ins]: any = await conn.execute(
                `INSERT INTO attendance_records (user_id, work_date, shift_id, clock_in, clock_out, source, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [edit.userId, edit.workDate, matched?.id ?? null, formatUtc(clockIn), clockOut ? formatUtc(clockOut) : null, source, edit.note ?? null, actorId]);
            id = ins.insertId;
        }
        await conn.commit();
        return id;
    } catch (err) {
        await conn.rollback().catch(() => {});
        throw err;
    } finally {
        conn.release();
    }
}

// ------------------------------------------------------------------------------------------------- leave

export interface LeaveType { id: number; code: string; name: string; days_per_year: number; paid: number; allows_half_day: number; unlimited: number; active: number; sort_order: number }

export async function leaveTypes(activeOnly = true): Promise<LeaveType[]> {
    return query<LeaveType[]>(`SELECT * FROM leave_types ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY sort_order, name`);
}

export interface BalanceRow { typeId: number; code: string; name: string; paid: boolean; unlimited: boolean; allowsHalfDay: boolean; entitled: number; used: number; pending: number; remaining: number }

export async function balances(userId: number, year: number): Promise<BalanceRow[]> {
    const types = await leaveTypes();
    const ents = await query<{ leave_type_id: number; days: number }[]>('SELECT leave_type_id, days FROM leave_entitlements WHERE user_id = ? AND year = ?', [userId, year]);
    const used = await query<{ leave_type_id: number; status: string; d: number }[]>(
        `SELECT leave_type_id, status, SUM(days) AS d FROM leave_requests
         WHERE user_id = ? AND status IN ('APPROVED','PENDING') AND YEAR(start_date) = ? GROUP BY leave_type_id, status`, [userId, year]);
    return types.map((t) => {
        const entitled = Number(ents.find((e) => e.leave_type_id === t.id)?.days ?? t.days_per_year);
        const approved = Number(used.find((u) => u.leave_type_id === t.id && u.status === 'APPROVED')?.d ?? 0);
        const pending = Number(used.find((u) => u.leave_type_id === t.id && u.status === 'PENDING')?.d ?? 0);
        return {
            typeId: t.id, code: t.code, name: t.name, paid: Boolean(t.paid), unlimited: Boolean(t.unlimited), allowsHalfDay: Boolean(t.allows_half_day),
            entitled, used: approved, pending, remaining: Math.round((entitled - approved - pending) * 10) / 10,
        };
    });
}

export interface LeaveInput { userId: number; leaveTypeId: number; start: string; end: string; dayPart: DayPart; reason: string | null }

/**
 * The days a request charges: calendar days minus public holidays and the person's rostered days off. A week that has a
 * roster for this person makes its empty days days off; a week with no roster counts all of its days.
 */
export async function chargeableDays(userId: number, start: string, end: string, dayPart: DayPart): Promise<{ days: number; dates: string[] }> {
    const holidays = new Set((await loadHolidays(start, end)).keys());
    const shifts = await loadShifts([userId], weekStart(start), addDays(weekStart(end), 6));
    const shiftDays = new Set(shifts.map((s) => s.shift_date));
    const coveredWeeks = new Set(shifts.map((s) => weekStart(s.shift_date)));
    const isDayOff = (day: string) => coveredWeeks.has(weekStart(day)) && !shiftDays.has(day);
    const dates = eachDay(start, end).filter((d) => !holidays.has(d) && !isDayOff(d));
    return { days: countLeaveDays({ start, end, dayPart }, holidays, isDayOff), dates };
}

export async function validateLeave(input: LeaveInput, opts: { ignoreRequestId?: number; skipPastCheck?: boolean; days?: number } = {}): Promise<{ days: number; dates: string[]; type: LeaveType }> {
    const ignoreRequestId = opts.ignoreRequestId ?? 0;
    if (!isDay(input.start) || !isDay(input.end)) throw new HrError(400, 'Choose valid dates');
    if (input.end < input.start) throw new HrError(400, 'The last day cannot be before the first day');
    if (input.start.slice(0, 4) !== input.end.slice(0, 4)) throw new HrError(400, 'A request cannot span two calendar years. Submit one request for each year.');
    if (!opts.skipPastCheck && input.start < addDays(localDay(new Date(), (await loadSettings()).timezone), -60)) throw new HrError(400, 'Leave cannot be requested more than 60 days in the past');
    const types = await leaveTypes();
    const type = types.find((t) => t.id === input.leaveTypeId);
    if (!type) throw new HrError(400, 'Choose a leave type');
    if (input.dayPart !== 'FULL') {
        if (input.start !== input.end) throw new HrError(400, 'A half day applies to a single day');
        if (!type.allows_half_day) throw new HrError(400, `${type.name} cannot be taken as a half day`);
    }
    const charged = await chargeableDays(input.userId, input.start, input.end, input.dayPart);
    const days = opts.days ?? charged.days;
    if (days <= 0) throw new HrError(400, 'There are no working days in that range (holidays and days off are not counted)');

    const clashing = (await loadLeave([input.userId], input.start, input.end, ['PENDING', 'APPROVED'])).find((l) =>
        l.id !== ignoreRequestId && leaveClashes({ start: input.start, end: input.end, dayPart: input.dayPart }, { start: l.start_date, end: l.end_date, dayPart: l.day_part }));
    if (clashing) throw new HrError(409, `This overlaps ${clashing.status === 'APPROVED' ? 'approved' : 'pending'} leave from ${clashing.start_date} to ${clashing.end_date}.`);

    if (!type.unlimited) {
        const bal = (await balances(input.userId, Number(input.start.slice(0, 4)))).find((b) => b.typeId === type.id)!;
        // The request being decided is already counted as pending, so give its own days back before comparing
        const own = ignoreRequestId ? Number((await query<{ days: number }[]>("SELECT days FROM leave_requests WHERE id = ? AND status IN ('APPROVED','PENDING')", [ignoreRequestId]))[0]?.days ?? 0) : 0;
        if (days > bal.remaining + own) throw new HrError(409, `${Math.max(0, bal.remaining + own)} ${type.name.toLowerCase()} day(s) left, and this needs ${days}.`);
    }
    return { days, dates: charged.dates, type };
}

export async function notifyHr(db: null, title: string, body: string, link: string, type: string): Promise<void> {
    const { notify, usersWithRole } = await import('@/lib/notify');
    const ids = [...(await usersWithRole(db, 'HR_MANAGER')), ...(await usersWithRole(db, 'ADMIN'))];
    await notify(db, ids, { type, title, body, link });
}

// ------------------------------------------------------------------------------------------------- shared query helpers

/** Who to include: one person, a department, or everyone active. */
export async function employeesFor(params: URLSearchParams): Promise<{ id: number; name: string; role: string; department: string | null; employeeNo: string | null }[]> {
    const userId = Number(params.get('userId'));
    const department = (params.get('department') ?? '').trim();
    const where: string[] = [`u.role IN (${STAFF_ROLES.map(() => '?').join(',')})`];
    const args: any[] = [...STAFF_ROLES];
    if (Number.isInteger(userId) && userId > 0) { where.push('u.id = ?'); args.push(userId); }
    else where.push("COALESCE(p.status, 'ACTIVE') = 'ACTIVE'");
    if (department) { where.push('p.department = ?'); args.push(department); }
    return query(`SELECT u.id, u.name, u.role, p.department, p.employee_no AS employeeNo FROM users u LEFT JOIN employee_profiles p ON p.user_id = u.id WHERE ${where.join(' AND ')} ORDER BY u.name LIMIT 500`, args);
}

export function rangeFrom(params: URLSearchParams, max = 93): { from: string; to: string } {
    const from = params.get('from') ?? '', to = params.get('to') ?? '';
    if (!isDay(from) || !isDay(to) || to < from) throw new HrError(400, 'Choose a valid date range');
    if (eachDay(from, to).length > max) throw new HrError(400, `Choose at most ${max} days at a time`);
    return { from, to };
}

