import { addDays, eachDay, minutesBetween, type Interval } from '@/lib/hr-time';

/** The business rules of the HR module as plain functions (no database), so they can be tested exhaustively. */

export interface Shift extends Interval { id: number; label?: string | null }

export interface Punch { id: number; shiftId: number | null; clockIn: Date; clockOut: Date | null }

export const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/**
 * The shift a punch belongs to: the one that contains the punch, or failing that the one whose start or end is nearest,
 * as long as the punch is within `windowMinutes` of that shift. No match means the punch is unscheduled.
 */
export function matchShift(at: Date, shifts: Shift[], windowMinutes: number): Shift | null {
    const window = windowMinutes * 60_000;
    const t = at.getTime();
    // Distance to the shift: zero inside it, otherwise to whichever end is nearer
    const distance = (s: Shift) => (t >= s.start.getTime() && t <= s.end.getTime() ? 0 : Math.min(Math.abs(t - s.start.getTime()), Math.abs(t - s.end.getTime())));
    const candidates = shifts.filter((s) => distance(s) <= window);
    if (candidates.length === 0) return null;
    return candidates.reduce((best, s) => (distance(s) < distance(best) ? s : best));
}

/** Minutes late, counted from the shift start, and only once the grace period is exceeded. */
export function lateMinutes(clockIn: Date, shiftStart: Date, graceMinutes: number): number {
    const late = minutesBetween(shiftStart, clockIn);
    return late > graceMinutes ? late : 0;
}

/** Minutes the person left before the shift ended, only once the grace period is exceeded. */
export function earlyLeaveMinutes(clockOut: Date, shiftEnd: Date, graceMinutes: number): number {
    const early = minutesBetween(clockOut, shiftEnd);
    return early > graceMinutes ? early : 0;
}

/** Minutes worked after the shift ended (reported, never paid by this system). */
export function extraMinutes(clockOut: Date, shiftEnd: Date, graceMinutes: number): number {
    const extra = minutesBetween(shiftEnd, clockOut);
    return extra > graceMinutes ? extra : 0;
}

export type DayStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'ON_LEAVE' | 'HOLIDAY' | 'DAY_OFF' | 'INCOMPLETE' | 'SCHEDULED';

export interface DayInput {
    day: string;
    shifts: Shift[];
    punches: Punch[];
    graceMinutes: number;
    isHoliday: boolean;
    onLeave: boolean;
    now: Date;
    /** An open punch older than this is "missing a clock-out" */
    missingClockOutHours: number;
}

export interface DayResult {
    day: string;
    status: DayStatus;
    workedMinutes: number;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    extraMinutes: number;
    unscheduled: boolean;
    scheduledMinutes: number;
}

/** One day of one person, from the roster, the punches and leave. */
export function evaluateDay(i: DayInput): DayResult {
    const scheduledMinutes = i.shifts.reduce((sum, s) => sum + minutesBetween(s.start, s.end), 0);
    let worked = 0, late = 0, early = 0, extra = 0, incomplete = false, unscheduled = false;

    for (const p of i.punches) {
        const shift = p.shiftId == null ? null : i.shifts.find((s) => s.id === p.shiftId) ?? null;
        if (!shift) unscheduled = true;
        if (p.clockOut) {
            worked += Math.max(0, minutesBetween(p.clockIn, p.clockOut));
        } else if (minutesBetween(p.clockIn, i.now) > i.missingClockOutHours * 60) {
            incomplete = true;
        } else {
            worked += Math.max(0, minutesBetween(p.clockIn, i.now));   // still working
        }
        if (shift) {
            late += lateMinutes(p.clockIn, shift.start, i.graceMinutes);
            if (p.clockOut) {
                early += earlyLeaveMinutes(p.clockOut, shift.end, i.graceMinutes);
                extra += extraMinutes(p.clockOut, shift.end, i.graceMinutes);
            }
        }
    }

    const base = { day: i.day, workedMinutes: worked, lateMinutes: late, earlyLeaveMinutes: early, extraMinutes: extra, unscheduled, scheduledMinutes };

    if (i.punches.length > 0) {
        if (incomplete) return { ...base, status: 'INCOMPLETE' };
        return { ...base, status: late > 0 ? 'LATE' : 'PRESENT' };
    }
    if (i.onLeave) return { ...base, status: 'ON_LEAVE' };
    if (i.isHoliday) return { ...base, status: 'HOLIDAY' };
    if (i.shifts.length === 0) return { ...base, status: 'DAY_OFF' };
    // Shifts but no punch: absent only once every shift has finished
    const lastEnd = i.shifts.reduce((m, s) => (s.end > m ? s.end : m), i.shifts[0].end);
    return { ...base, status: lastEnd < i.now ? 'ABSENT' : 'SCHEDULED' };
}

// ---------------------------------------------------------------------------------------------------- leave

export type DayPart = 'FULL' | 'FIRST_HALF' | 'SECOND_HALF';

export interface LeaveSpan { start: string; end: string; dayPart: DayPart }

/**
 * Leave days charged for a request: every calendar day in the range, except public holidays and days that are the
 * person's day off. A half day applies to a single day and counts 0.5.
 */
export function countLeaveDays(span: LeaveSpan, holidays: ReadonlySet<string>, isDayOff: (day: string) => boolean): number {
    let days = 0;
    for (const day of eachDay(span.start, span.end)) {
        if (holidays.has(day) || isDayOff(day)) continue;
        days += span.dayPart === 'FULL' ? 1 : 0.5;
    }
    return days;
}

/**
 * Whether two leave requests clash. Overlapping dates clash, except one morning half day and one afternoon half day on
 * the same single day, which can coexist.
 */
export function leaveClashes(a: LeaveSpan, b: LeaveSpan): boolean {
    if (a.start > b.end || b.start > a.end) return false;
    const aSingle = a.start === a.end, bSingle = b.start === b.end;
    if (aSingle && bSingle && a.start === b.start && a.dayPart !== 'FULL' && b.dayPart !== 'FULL' && a.dayPart !== b.dayPart) return false;
    return true;
}

export interface Balance { entitled: number; used: number; pending: number; remaining: number }

/** Entitlement minus approved days; pending requests are set aside so two requests cannot spend the same days. */
export function balance(entitled: number, approvedDays: number, pendingDays: number): Balance {
    return { entitled, used: approvedDays, pending: pendingDays, remaining: Math.round((entitled - approvedDays - pendingDays) * 10) / 10 };
}

/** The same calendar year check used for entitlements: a request that straddles New Year is split by year. */
export function daysByYear(span: LeaveSpan, holidays: ReadonlySet<string>, isDayOff: (day: string) => boolean): Record<number, number> {
    const out: Record<number, number> = {};
    for (const day of eachDay(span.start, span.end)) {
        if (holidays.has(day) || isDayOff(day)) continue;
        const year = Number(day.slice(0, 4));
        out[year] = (out[year] ?? 0) + (span.dayPart === 'FULL' ? 1 : 0.5);
    }
    return out;
}

export { addDays };

export interface Summary {
    scheduledDays: number; presentDays: number; lateDays: number; absentDays: number; leaveDays: number; holidays: number; incompleteDays: number; unscheduledDays: number;
    workedMinutes: number; lateMinutes: number; earlyLeaveMinutes: number; extraMinutes: number; scheduledMinutes: number;
}

/** Totals for a stretch of days (a month on the dashboard, a person in the HR report). */
export function summariseDays(days: DayResult[]): Summary {
    const s: Summary = { scheduledDays: 0, presentDays: 0, lateDays: 0, absentDays: 0, leaveDays: 0, holidays: 0, incompleteDays: 0, unscheduledDays: 0, workedMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0, extraMinutes: 0, scheduledMinutes: 0 };
    for (const d of days) {
        s.workedMinutes += d.workedMinutes; s.lateMinutes += d.lateMinutes; s.earlyLeaveMinutes += d.earlyLeaveMinutes; s.extraMinutes += d.extraMinutes; s.scheduledMinutes += d.scheduledMinutes;
        if (d.scheduledMinutes > 0) s.scheduledDays++;
        if (d.unscheduled) s.unscheduledDays++;
        switch (d.status) {
            case 'PRESENT': s.presentDays++; break;
            case 'LATE': s.presentDays++; s.lateDays++; break;
            case 'ABSENT': s.absentDays++; break;
            case 'ON_LEAVE': s.leaveDays++; break;
            case 'HOLIDAY': s.holidays++; break;
            case 'INCOMPLETE': s.incompleteDays++; break;
            default: break;
        }
    }
    return s;
}
