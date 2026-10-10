import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest';
import { pool, query } from '@/lib/db';
import { state } from '../helpers/state';
import { as, post, one, rows, ALICE, DOCTOR, PHARMACIST, RECEPTIONIST } from './helpers';
import { clockIn, clockOut, evaluateRange, loadSettings } from '@/lib/hr';
import { addDays, localDay, zonedToUtc } from '@/lib/hr-time';
import { verifyChain } from '@/lib/audit';

// The HR module through its real routes: who can see what, the clock rules, corrections, shifts and leave.

afterAll(async () => { await pool.end(); });

const ADMIN = 1;
let HR1 = 0, HR2 = 0;
const FUTURE_MON = '2027-03-01';   // a Monday well after "today"; no roster exists for it

const api = {
    shifts: () => import('@/app/api/hr/shifts/route'),
    clock: () => import('@/app/api/hr/me/clock/route'),
    today: () => import('@/app/api/hr/me/today/route'),
    myAtt: () => import('@/app/api/hr/me/attendance/route'),
    myLeave: () => import('@/app/api/hr/me/leave/route'),
    myLeaveId: () => import('@/app/api/hr/me/leave/[id]/route'),
    myCorr: () => import('@/app/api/hr/me/corrections/route'),
    leave: () => import('@/app/api/hr/leave/route'),
    leaveId: () => import('@/app/api/hr/leave/[id]/route'),
    corr: () => import('@/app/api/hr/corrections/route'),
    corrId: () => import('@/app/api/hr/corrections/[id]/route'),
    att: () => import('@/app/api/hr/attendance/route'),
    attExport: () => import('@/app/api/hr/attendance/export/route'),
    rec: () => import('@/app/api/hr/attendance/records/route'),
    recId: () => import('@/app/api/hr/attendance/records/[id]/route'),
    employees: () => import('@/app/api/hr/employees/route'),
    holidays: () => import('@/app/api/hr/holidays/route'),
};
const ctxId = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });
const json = async (res: Response) => res.json();

async function makeHr(label: string) {
    const r: any = await query(`INSERT INTO users (email, password_hash, name, role, is_verified) VALUES (?, 'x', ?, 'HR_MANAGER', 1)`, [`${label}.${Date.now()}@hr-test.local`, `HR ${label}`]);
    return r.insertId as number;
}

beforeAll(async () => { HR1 = await makeHr('one'); HR2 = await makeHr('two'); });
beforeEach(async () => {
    state.token = null;
    await query('DELETE FROM attendance_corrections');
    await query('DELETE FROM attendance_records');
    await query('DELETE FROM leave_requests');
    await query('DELETE FROM shift_assignments');
    await query('DELETE FROM public_holidays');
    await query('DELETE FROM doctor_leaves WHERE leave_request_id IS NOT NULL');
    await query('DELETE FROM leave_entitlements');
    await query('DELETE FROM notifications WHERE type IN (?, ?, ?, ?, ?)', ['LEAVE_REQUEST', 'LEAVE_DECISION', 'ATTENDANCE_CORRECTION', 'SHIFT_ASSIGNED', 'ATTENDANCE_EDITED']);
});

const tz = () => loadSettings().then((s) => s.timezone);
const todayLocal = async () => localDay(new Date(), await tz());

async function addShift(userId: number, date: string, start: string, end: string) {
    await query('INSERT INTO shift_assignments (user_id, shift_date, start_time, end_time) VALUES (?, ?, ?, ?)', [userId, date, start, end]);
}

describe('who can reach the HR routes', () => {
    it('staff reach My Work; patients do not', async () => {
        const today = await api.today();
        for (const [role, id] of [['PHARMACIST', PHARMACIST], ['DOCTOR', DOCTOR], ['RECEPTIONIST', RECEPTIONIST], ['ADMIN', ADMIN], ['HR_MANAGER', HR1]] as const) {
            await as(role, id);
            expect((await today.GET()).status, role).toBe(200);
        }
        await as('PATIENT', ALICE);
        expect((await today.GET()).status).toBe(403);
    });

    it('only HR and administrators reach the HR portal', async () => {
        const employees = await api.employees();
        for (const [role, id] of [['PHARMACIST', PHARMACIST], ['DOCTOR', DOCTOR], ['RECEPTIONIST', RECEPTIONIST], ['PATIENT', ALICE]] as const) {
            await as(role, id);
            expect((await employees.GET(new Request('http://x'))).status, role).toBe(403);
        }
        for (const [role, id] of [['HR_MANAGER', HR1], ['ADMIN', ADMIN]] as const) {
            await as(role, id);
            expect((await employees.GET(new Request('http://x'))).status, role).toBe(200);
        }
    });
});

describe('planning shifts', () => {
    const create = async (body: unknown) => (await api.shifts()).POST(post('/x', body));

    it('adds several shifts a day for several people over chosen weekdays', async () => {
        await as('HR_MANAGER', HR1);
        const res = await create({
            userIds: [PHARMACIST, RECEPTIONIST],
            range: { from: FUTURE_MON, to: addDays(FUTURE_MON, 6), weekdays: [1, 2, 3] },
            times: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00', label: 'Afternoon' }],
        });
        expect(res.status).toBe(201);
        const body = await json(res);
        expect(body.created).toBe(2 * 3 * 2);
        expect(body.skipped).toEqual([]);
        expect(Number((await one('SELECT COUNT(*) AS n FROM shift_assignments WHERE user_id = ?', [PHARMACIST])).n)).toBe(6);
    });

    it('skips overlaps and people on approved leave, and reports why', async () => {
        await as('HR_MANAGER', HR1);
        await addShift(PHARMACIST, FUTURE_MON, '09:00', '13:00');
        await query(`INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, day_part, days, status) VALUES (?, 1, ?, ?, 'FULL', 1, 'APPROVED')`, [RECEPTIONIST, FUTURE_MON, FUTURE_MON]);
        const res = await create({ userIds: [PHARMACIST, RECEPTIONIST], dates: [FUTURE_MON], times: [{ start: '12:00', end: '16:00' }] });
        const body = await json(res);
        expect(body.created).toBe(0);
        expect(body.skipped.map((s: any) => s.reason).sort()).toEqual(['On approved leave', 'Overlaps a shift they already have']);
    });

    it('allows a night shift and refuses back-to-back overlap with it', async () => {
        await as('HR_MANAGER', HR1);
        expect((await create({ userIds: [PHARMACIST], dates: [FUTURE_MON], times: [{ start: '19:00', end: '07:00' }] })).status).toBe(201);
        const next = await json(await create({ userIds: [PHARMACIST], dates: [addDays(FUTURE_MON, 1)], times: [{ start: '06:00', end: '09:00' }] }));
        expect(next.created).toBe(0);                                    // 06:00 the next morning is still inside the night shift
        expect((await create({ userIds: [PHARMACIST], dates: [addDays(FUTURE_MON, 1)], times: [{ start: '07:00', end: '09:00' }] })).status).toBe(201);
    });

    it.each([
        [{ userIds: [PHARMACIST], dates: [FUTURE_MON], times: [{ start: '08:00', end: '08:00' }] }, /same time/],
        [{ userIds: [PHARMACIST], dates: [FUTURE_MON], times: [{ start: '08:00', end: '12:00' }, { start: '11:00', end: '15:00' }] }, /overlap/],
        [{ userIds: [PHARMACIST], dates: [FUTURE_MON], times: [{ start: '06:00', end: '23:00' }] }, /16 hours/],
        [{ userIds: [], dates: [FUTURE_MON], times: [{ start: '08:00', end: '12:00' }] }, /at least one person/i],
        [{ userIds: [PHARMACIST], times: [{ start: '08:00', end: '12:00' }] }, /dates/i],
    ])('rejects bad input %j', async (body, message) => {
        await as('HR_MANAGER', HR1);
        const res = await create(body);
        expect(res.status).toBe(400);
        expect((await json(res)).message).toMatch(message);
    });

    it('does not add shifts for patients', async () => {
        await as('HR_MANAGER', HR1);
        const body = await json(await create({ userIds: [ALICE], dates: [FUTURE_MON], times: [{ start: '08:00', end: '12:00' }] }));
        expect(body.created).toBe(0);
        expect(body.skipped[0].reason).toMatch(/staff/i);
    });

    it('keeps a shift someone has already worked when it is deleted', async () => {
        await as('HR_MANAGER', HR1);
        await addShift(PHARMACIST, FUTURE_MON, '08:00', '12:00');
        await addShift(PHARMACIST, addDays(FUTURE_MON, 1), '08:00', '12:00');
        const [worked, free] = await rows<any>('SELECT id FROM shift_assignments WHERE user_id = ? ORDER BY shift_date', [PHARMACIST]);
        await query(`INSERT INTO attendance_records (user_id, work_date, shift_id, clock_in, clock_out) VALUES (?, ?, ?, '2027-03-01 02:30:00', '2027-03-01 06:30:00')`, [PHARMACIST, FUTURE_MON, worked.id]);
        const res = await (await api.shifts()).DELETE(post('/x', { ids: [worked.id, free.id] }, 'DELETE'));
        expect(await json(res)).toEqual({ removed: 1, kept: 1 });
    });
});

describe('clocking in and out', () => {
    const clock = async (action: 'IN' | 'OUT') => (await api.clock()).POST(post('/x', { action }));

    it('uses the server time and ignores anything the browser sends', async () => {
        await as('PHARMACIST', PHARMACIST);
        const res = await (await api.clock()).POST(post('/x', { action: 'IN', at: '2001-01-01T00:00:00Z', time: '03:00' }));
        expect(res.status).toBe(200);
        const rec = await one('SELECT clock_in FROM attendance_records WHERE user_id = ?', [PHARMACIST]);
        expect(Math.abs(new Date(rec.clock_in + 'Z').getTime() - Date.now())).toBeLessThan(60_000);
    });

    it('refuses a second clock-in, and a clock-out when not clocked in', async () => {
        await as('PHARMACIST', PHARMACIST);
        expect((await clock('OUT')).status).toBe(409);
        expect((await clock('IN')).status).toBe(200);
        const again = await clock('IN');
        expect(again.status).toBe(409);
        expect((await json(again)).message).toMatch(/already clocked in/i);
        expect((await clock('OUT')).status).toBe(200);
        expect((await clock('OUT')).status).toBe(409);
    });

    it('a punch with no shift is flagged unscheduled but allowed', async () => {
        await as('RECEPTIONIST', RECEPTIONIST);
        const body = await json(await clock('IN'));
        expect(body.unscheduled).toBe(true);
    });

    it('a double click does not create two sessions', async () => {
        await as('PHARMACIST', PHARMACIST);
        const results = await Promise.all([clock('IN'), clock('IN'), clock('IN')]);
        expect(results.filter((r) => r.status === 200)).toHaveLength(1);
        expect(Number((await one('SELECT COUNT(*) AS n FROM attendance_records WHERE user_id = ? AND clock_out IS NULL', [PHARMACIST])).n)).toBe(1);
    });

    it('flags lateness only beyond the grace period, measured from the shift start', async () => {
        const day = await todayLocal();
        const start = zonedToUtc(day, '08:00', await tz());
        await addShift(PHARMACIST, day, '08:00', '13:00');
        const withinGrace = await clockIn(PHARMACIST, null, new Date(start.getTime() + 8 * 60_000));
        expect(withinGrace).toMatchObject({ lateMinutes: 0, unscheduled: false });
        await query('DELETE FROM attendance_records WHERE user_id = ?', [PHARMACIST]);
        const late = await clockIn(PHARMACIST, null, new Date(start.getTime() + 25 * 60_000));
        expect(late).toMatchObject({ lateMinutes: 25, unscheduled: false });
        await query('DELETE FROM attendance_records WHERE user_id = ?', [PHARMACIST]);
        const early = await clockIn(PHARMACIST, null, new Date(start.getTime() - 60 * 60_000));
        expect(early).toMatchObject({ lateMinutes: 0, early: true, unscheduled: false });
    });

    it('arriving after a shift has finished is not late for it: it matches the next shift, or is unscheduled', async () => {
        const day = await todayLocal();
        const zone = await tz();
        await addShift(PHARMACIST, day, '08:00', '12:00');
        await addShift(PHARMACIST, day, '14:00', '18:00');
        const at1206 = await clockIn(PHARMACIST, null, zonedToUtc(day, '12:06', zone));
        expect(at1206).toMatchObject({ unscheduled: false, lateMinutes: 0, early: true });   // for the 14:00 shift, not 4 hours late for the morning one
        await query('DELETE FROM attendance_records WHERE user_id = ?', [PHARMACIST]);
        await query('DELETE FROM shift_assignments WHERE user_id = ? AND start_time = ?', [PHARMACIST, '14:00:00']);
        const after = await clockIn(PHARMACIST, null, zonedToUtc(day, '12:30', zone));
        expect(after).toMatchObject({ unscheduled: true, lateMinutes: 0 });
    });

    it('a punch after midnight belongs to the night shift that began the evening before', async () => {
        const day = await todayLocal();
        const zone = await tz();
        await addShift(PHARMACIST, addDays(day, -1), '19:00', '07:00');
        const result = await clockIn(PHARMACIST, null, zonedToUtc(day, '01:00', zone));
        expect(result.unscheduled).toBe(false);
        expect(result.workDate).toBe(addDays(day, -1));
    });

    it('a session left open for too long no longer blocks the next day', async () => {
        await query(`INSERT INTO attendance_records (user_id, work_date, clock_in) VALUES (?, ?, ?)`, [PHARMACIST, addDays(await todayLocal(), -3), new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 23).replace('T', ' ')]);
        await as('PHARMACIST', PHARMACIST);
        expect((await clock('IN')).status).toBe(200);
        const settings = await loadSettings();
        const days = (await evaluateRange([PHARMACIST], addDays(await todayLocal(), -3), addDays(await todayLocal(), -3), settings)).get(PHARMACIST)!;
        expect(days[0].status).toBe('INCOMPLETE');
    });

    it('only shows you your own attendance', async () => {
        await query(`INSERT INTO attendance_records (user_id, work_date, clock_in, clock_out) VALUES (?, ?, '2026-10-05 03:00:00', '2026-10-05 08:00:00')`, [RECEPTIONIST, '2026-10-05']);
        await as('PHARMACIST', PHARMACIST);
        const body = await json(await (await api.myAtt()).GET(new Request('http://x?month=2026-10')));
        expect(body.days.every((d: any) => d.punches.length === 0 || d.punches.every((p: any) => p.id !== undefined))).toBe(true);
        expect(body.summary.workedMinutes).toBe(0);
    });
});

describe('corrections', () => {
    const request = async (body: unknown) => (await api.myCorr()).POST(post('/x', body));
    const day = async () => addDays(await todayLocal(), -2);

    it('an approved correction creates the session, marked as a correction', async () => {
        const d = await day();
        await as('PHARMACIST', PHARMACIST);
        const created = await request({ workDate: d, clockIn: '08:00', clockOut: '13:00', reason: 'Forgot to clock in' });
        expect(created.status).toBe(201);
        const { id } = await json(created);
        await as('HR_MANAGER', HR1);
        expect((await (await api.corrId()).PUT(post('/x', { decision: 'APPROVE' }, 'PUT'), ctxId(id))).status).toBe(200);
        expect(await one('SELECT source, clock_out IS NOT NULL AS closed FROM attendance_records WHERE user_id = ? AND work_date = ?', [PHARMACIST, d])).toMatchObject({ source: 'CORRECTION', closed: 1 });
    });

    it('cannot be decided by the person who asked, and a second pending one for the same day is refused', async () => {
        const d = await day();
        await as('HR_MANAGER', HR1);
        const { id } = await json(await request({ workDate: d, clockIn: '08:00', clockOut: '13:00', reason: 'HR forgot too' }));
        const own = await (await api.corrId()).PUT(post('/x', { decision: 'APPROVE' }, 'PUT'), ctxId(id));
        expect(own.status).toBe(403);
        expect((await request({ workDate: d, clockIn: '09:00', clockOut: '12:00', reason: 'Again please' })).status).toBe(409);
        await as('HR_MANAGER', HR2);
        expect((await (await api.corrId()).PUT(post('/x', { decision: 'REJECT', note: 'No evidence' }, 'PUT'), ctxId(id))).status).toBe(200);
        expect(await one('SELECT status FROM attendance_corrections WHERE id = ?', [id])).toMatchObject({ status: 'REJECTED' });
    });

    it('refuses future days, very old days and missing reasons', async () => {
        await as('PHARMACIST', PHARMACIST);
        expect((await request({ workDate: addDays(await todayLocal(), 2), clockIn: '08:00', reason: 'Not yet happened' })).status).toBe(400);
        expect((await request({ workDate: addDays(await todayLocal(), -60), clockIn: '08:00', reason: 'Too long ago' })).status).toBe(400);
        expect((await request({ workDate: await day(), clockIn: '08:00', reason: 'x' })).status).toBe(400);
    });

    it('a correction that overlaps another session is refused when approved', async () => {
        const d = await day();
        await query(`INSERT INTO attendance_records (user_id, work_date, clock_in, clock_out) VALUES (?, ?, ?, ?)`, [PHARMACIST, d, zonedStr(d, '09:00'), zonedStr(d, '12:00')]);
        await as('PHARMACIST', PHARMACIST);
        const { id } = await json(await request({ workDate: d, clockIn: '10:00', clockOut: '14:00', reason: 'Worked longer' }));
        await as('HR_MANAGER', HR1);
        expect((await (await api.corrId()).PUT(post('/x', { decision: 'APPROVE' }, 'PUT'), ctxId(id))).status).toBe(409);
    });
});

function zonedStr(day: string, time: string) {
    return zonedToUtc(day, time, 'Asia/Colombo').toISOString().slice(0, 23).replace('T', ' ');
}

describe('HR editing attendance', () => {
    it('needs a reason, and nobody edits their own', async () => {
        const d = addDays(await todayLocal(), -1);
        await as('HR_MANAGER', HR1);
        const bad = await (await api.rec()).POST(post('/x', { userId: PHARMACIST, workDate: d, clockIn: '08:00', clockOut: '13:00', reason: '' }));
        expect(bad.status).toBe(400);
        const self = await (await api.rec()).POST(post('/x', { userId: HR1, workDate: d, clockIn: '08:00', clockOut: '13:00', reason: 'Fixing my own day' }));
        expect(self.status).toBe(403);
        const ok = await (await api.rec()).POST(post('/x', { userId: PHARMACIST, workDate: d, clockIn: '08:00', clockOut: '13:00', reason: 'Missed punch at the door' }));
        expect(ok.status).toBe(201);
        const { id } = await json(ok);
        expect(await one('SELECT source, note FROM attendance_records WHERE id = ?', [id])).toMatchObject({ source: 'HR', note: 'Missed punch at the door' });
        const del = await (await api.recId()).DELETE(new Request(`http://x?reason=${encodeURIComponent('Entered by mistake')}`, { method: 'DELETE' }), ctxId(id));
        expect(del.status).toBe(200);
    });

    it('is recorded in the audit trail with who and why', async () => {
        const d = addDays(await todayLocal(), -1);
        await as('HR_MANAGER', HR1);
        const res = await (await api.rec()).POST(post('/x', { userId: PHARMACIST, workDate: d, clockIn: '08:00', clockOut: '13:00', reason: 'Audit me please' }));
        const { id } = await json(res);
        const entry = await one(`SELECT actor_id, details FROM audit_log WHERE entity_type = 'ATTENDANCE' AND entity_id = ? AND action = 'CREATE' ORDER BY id DESC LIMIT 1`, [String(id)]);
        expect(entry.actor_id).toBe(HR1);
        expect(JSON.parse(entry.details)).toMatchObject({ employeeId: PHARMACIST, reason: 'Audit me please' });
    });

    it('opening someone attendance is audited, and the export is too', async () => {
        await as('HR_MANAGER', HR1);
        const att = await api.att();
        expect((await att.GET(new Request(`http://x?userId=${PHARMACIST}&from=2026-10-01&to=2026-10-07`))).status).toBe(200);
        expect(await one(`SELECT 1 AS x FROM audit_log WHERE action = 'VIEW' AND entity_type = 'ATTENDANCE' AND actor_id = ? AND entity_id = ?`, [HR1, String(PHARMACIST)])).toBeTruthy();
        const exp = await (await api.attExport()).GET(new Request(`http://x?from=2026-10-01&to=2026-10-07`));
        expect(exp.headers.get('content-type')).toContain('text/csv');
        expect(await one(`SELECT 1 AS x FROM audit_log WHERE action = 'EXPORT' AND entity_type = 'ATTENDANCE' AND actor_id = ?`, [HR1])).toBeTruthy();
        await as('PHARMACIST', PHARMACIST);
        expect((await (await api.attExport()).GET(new Request(`http://x?from=2026-10-01&to=2026-10-07`))).status).toBe(403);
    });
});

describe('leave', () => {
    const request = async (body: Record<string, unknown>) => (await api.myLeave()).POST(post('/x', { leaveTypeId: 1, dayPart: 'FULL', ...body }));
    const decide = async (id: number, decision: 'APPROVE' | 'REJECT', extra: Record<string, unknown> = {}) => (await api.leaveId()).PUT(post('/x', { decision, ...extra }, 'PUT'), ctxId(id));

    it('charges calendar days minus public holidays', async () => {
        await query(`INSERT INTO public_holidays (holiday_date, name) VALUES (?, 'Test holiday')`, [addDays(FUTURE_MON, 2)]);
        await as('PHARMACIST', PHARMACIST);
        const res = await request({ start: FUTURE_MON, end: addDays(FUTURE_MON, 4) });
        expect(res.status).toBe(201);
        expect((await json(res)).days).toBe(4);
    });

    it('refuses overlapping requests, but a morning and an afternoon half day can share a date', async () => {
        await as('PHARMACIST', PHARMACIST);
        expect((await request({ start: FUTURE_MON, end: addDays(FUTURE_MON, 2) })).status).toBe(201);
        const clash = await request({ start: addDays(FUTURE_MON, 2), end: addDays(FUTURE_MON, 3) });
        expect(clash.status).toBe(409);
        expect((await json(clash)).message).toMatch(/overlaps/i);
        const d = addDays(FUTURE_MON, 10);
        expect((await request({ start: d, end: d, dayPart: 'FIRST_HALF' })).status).toBe(201);
        expect((await request({ start: d, end: d, dayPart: 'SECOND_HALF' })).status).toBe(201);
        expect((await request({ start: d, end: d, dayPart: 'FIRST_HALF' })).status).toBe(409);
    });

    it('refuses a half day across several days, a request that spans two years, and unknown types', async () => {
        await as('PHARMACIST', PHARMACIST);
        expect((await request({ start: FUTURE_MON, end: addDays(FUTURE_MON, 1), dayPart: 'FIRST_HALF' })).status).toBe(400);
        expect((await request({ start: '2026-12-30', end: '2027-01-02' })).status).toBe(400);
        expect((await request({ start: FUTURE_MON, end: FUTURE_MON, leaveTypeId: 9999 })).status).toBe(400);
    });

    it('cannot use more than the balance, but unpaid leave has no limit', async () => {
        await as('PHARMACIST', PHARMACIST);
        await query('INSERT INTO leave_entitlements (user_id, leave_type_id, year, days) VALUES (?, 1, 2027, 3)', [PHARMACIST]);
        const tooMuch = await request({ start: FUTURE_MON, end: addDays(FUTURE_MON, 4) });
        expect(tooMuch.status).toBe(409);
        expect((await json(tooMuch)).message).toMatch(/3 annual leave day/);
        expect((await request({ start: FUTURE_MON, end: addDays(FUTURE_MON, 2) })).status).toBe(201);
        expect((await request({ start: addDays(FUTURE_MON, 7), end: addDays(FUTURE_MON, 20), leaveTypeId: 3 })).status).toBe(201);
    });

    it('pending requests set days aside, so two requests cannot spend the same ones', async () => {
        await as('PHARMACIST', PHARMACIST);
        await query('INSERT INTO leave_entitlements (user_id, leave_type_id, year, days) VALUES (?, 1, 2027, 3)', [PHARMACIST]);
        expect((await request({ start: FUTURE_MON, end: addDays(FUTURE_MON, 2) })).status).toBe(201);
        expect((await request({ start: addDays(FUTURE_MON, 7), end: addDays(FUTURE_MON, 7) })).status).toBe(409);
        const mine = await json(await (await api.myLeave()).GET(new Request('http://x?year=2027')));
        expect(mine.balances.find((b: any) => b.code === 'ANNUAL')).toMatchObject({ entitled: 3, pending: 3, used: 0, remaining: 0 });
    });

    it('approval is HR only, never by the requester, and moves the days from pending to used', async () => {
        await as('PHARMACIST', PHARMACIST);
        const { id } = await json(await request({ start: FUTURE_MON, end: addDays(FUTURE_MON, 1) }));
        expect((await decide(id, 'APPROVE')).status).toBe(403);   // a pharmacist is not HR
        await as('HR_MANAGER', HR1);
        expect((await decide(id, 'APPROVE')).status).toBe(200);
        expect((await decide(id, 'APPROVE')).status).toBe(409);   // already decided
        await as('PHARMACIST', PHARMACIST);
        const mine = await json(await (await api.myLeave()).GET(new Request('http://x?year=2027')));
        expect(mine.balances.find((b: any) => b.code === 'ANNUAL')).toMatchObject({ used: 2, pending: 0, remaining: 12 });
    });

    it('HR cannot approve their own leave; another HR manager or an administrator can', async () => {
        await as('HR_MANAGER', HR1);
        const { id } = await json(await request({ start: FUTURE_MON, end: FUTURE_MON }));
        expect((await decide(id, 'APPROVE')).status).toBe(403);
        await as('ADMIN', ADMIN);
        expect((await decide(id, 'APPROVE')).status).toBe(200);
    });

    it('a rejected request frees the days and can be asked again', async () => {
        await as('PHARMACIST', PHARMACIST);
        const { id } = await json(await request({ start: FUTURE_MON, end: addDays(FUTURE_MON, 1) }));
        await as('HR_MANAGER', HR1);
        expect((await decide(id, 'REJECT', { note: 'Short staffed' })).status).toBe(200);
        await as('PHARMACIST', PHARMACIST);
        expect((await request({ start: FUTURE_MON, end: addDays(FUTURE_MON, 1) })).status).toBe(201);
    });

    it('a doctor on approved leave cannot be booked on those days, and cancelling gives the days back', async () => {
        const monday = addDays(FUTURE_MON, 14);
        await query(`INSERT INTO appointments (patient_id, doctor_id, date, time_slot, queue_number, status) VALUES (?, ?, ?, '10:00', 1, 'PENDING')`, [ALICE, DOCTOR, addDays(monday, 1)]);
        await as('DOCTOR', DOCTOR);
        const { id } = await json(await request({ start: monday, end: addDays(monday, 2) }));
        await as('HR_MANAGER', HR1);
        const listed = await json(await (await api.leave()).GET(new Request('http://x')));
        expect(listed.requests.find((r: any) => r.id === id)).toMatchObject({ role: 'DOCTOR', bookedAppointments: 1 });
        const approved = await json(await decide(id, 'APPROVE'));
        expect(approved).toMatchObject({ blockedDoctorDays: 3, affectedAppointments: 1 });
        expect(Number((await one('SELECT COUNT(*) AS n FROM doctor_leaves WHERE doctor_id = ? AND leave_request_id = ?', [DOCTOR, id])).n)).toBe(3);
        expect(await one(`SELECT 1 AS x FROM notifications WHERE user_id = ? AND type = 'DOCTOR_LEAVE' ORDER BY id DESC LIMIT 1`, [ALICE])).toBeTruthy();

        await as('DOCTOR', DOCTOR);
        expect((await (await api.myLeaveId()).DELETE(new Request('http://x', { method: 'DELETE' }), ctxId(id))).status).toBe(200);
        expect(Number((await one('SELECT COUNT(*) AS n FROM doctor_leaves WHERE leave_request_id = ?', [id])).n)).toBe(0);
        await query('DELETE FROM appointments WHERE patient_id = ? AND date = ?', [ALICE, addDays(monday, 1)]);
    });

    it('a person can only cancel their own request', async () => {
        await as('PHARMACIST', PHARMACIST);
        const { id } = await json(await request({ start: FUTURE_MON, end: FUTURE_MON }));
        await as('RECEPTIONIST', RECEPTIONIST);
        expect((await (await api.myLeaveId()).DELETE(new Request('http://x', { method: 'DELETE' }), ctxId(id))).status).toBe(404);
    });

    it('HR may correct the days charged on approval', async () => {
        await as('PHARMACIST', PHARMACIST);
        const { id } = await json(await request({ start: FUTURE_MON, end: addDays(FUTURE_MON, 4) }));
        await as('HR_MANAGER', HR1);
        expect((await json(await decide(id, 'APPROVE', { days: 4 }))).days).toBe(4);
    });

    it('does not count the days off in a week that has a roster', async () => {
        await addShift(PHARMACIST, FUTURE_MON, '08:00', '17:00');
        await addShift(PHARMACIST, addDays(FUTURE_MON, 1), '08:00', '17:00');
        await addShift(PHARMACIST, addDays(FUTURE_MON, 3), '08:00', '17:00');
        await as('PHARMACIST', PHARMACIST);
        const res = await request({ start: FUTURE_MON, end: addDays(FUTURE_MON, 6) });
        expect((await json(res)).days).toBe(3);
    });
});

describe('holidays and settings need HR', () => {
    it('only HR adds holidays, and staff cannot read the settings', async () => {
        const holidays = await api.holidays();
        await as('PHARMACIST', PHARMACIST);
        expect((await holidays.POST(post('/x', { date: '2027-04-13', name: 'New Year' }))).status).toBe(403);
        await as('HR_MANAGER', HR1);
        expect((await holidays.POST(post('/x', { date: '2027-04-13', name: 'New Year' }))).status).toBe(201);
        expect((await holidays.POST(post('/x', { date: 'not-a-date', name: 'Bad' }))).status).toBe(400);
        await query('DELETE FROM public_holidays');
    });
});

describe('the audit trail is intact after all of this', () => {
    it('verifies', async () => {
        expect((await verifyChain()).ok).toBe(true);
    });
});
