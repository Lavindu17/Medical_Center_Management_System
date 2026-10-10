import { describe, it, expect } from 'vitest';
import { addDays, daysBetween, eachDay, isDay, isTime, localDay, localTime, normTime, shiftInterval, timeToMinutes, weekStart, weekday, zonedToUtc } from '@/lib/hr-time';
import { balance, countLeaveDays, daysByYear, earlyLeaveMinutes, evaluateDay, extraMinutes, lateMinutes, leaveClashes, matchShift, overlaps, type Punch, type Shift } from '@/lib/hr-rules';

const TZ = 'Asia/Colombo';   // UTC+5:30, no daylight saving
const at = (day: string, time: string) => zonedToUtc(day, time, TZ);

describe('clinic time zone', () => {
    it('converts clinic wall time to the right UTC instant', () => {
        expect(at('2026-10-12', '08:00').toISOString()).toBe('2026-10-12T02:30:00.000Z');
        expect(at('2026-10-12', '00:00').toISOString()).toBe('2026-10-11T18:30:00.000Z');
    });
    it('reads the local day and time back, including around midnight', () => {
        const lateNight = new Date('2026-10-12T19:00:00Z');       // 00:30 the next day in Colombo
        expect(localDay(lateNight, TZ)).toBe('2026-10-13');
        expect(localTime(lateNight, TZ)).toBe('00:30');
    });
    it('works for a zone with daylight saving (a clinic elsewhere)', () => {
        expect(zonedToUtc('2026-07-01', '09:00', 'Europe/London').toISOString()).toBe('2026-07-01T08:00:00.000Z');
        expect(zonedToUtc('2026-01-01', '09:00', 'Europe/London').toISOString()).toBe('2026-01-01T09:00:00.000Z');
    });
    it('validates days and times', () => {
        expect(isDay('2026-02-29')).toBe(false);
        expect(isDay('2028-02-29')).toBe(true);
        expect(isDay('26-10-12')).toBe(false);
        expect(isTime('24:00')).toBe(false);
        expect(isTime('7:05')).toBe(true);
        expect(normTime('7:05:30')).toBe('07:05');
        expect(timeToMinutes('08:30')).toBe(510);
    });
    it('does calendar arithmetic', () => {
        expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
        expect(daysBetween('2026-10-01', '2026-10-31')).toBe(30);
        expect(eachDay('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
        expect(weekday('2026-10-12')).toBe(1);               // Monday
        expect(weekStart('2026-10-18')).toBe('2026-10-12');  // Sunday belongs to the week starting Monday
        expect(weekStart('2026-10-12')).toBe('2026-10-12');
    });
});

describe('shift intervals', () => {
    it('a day shift ends the same day', () => {
        const s = shiftInterval('2026-10-12', '08:00', '17:00', TZ);
        expect((s.end.getTime() - s.start.getTime()) / 3_600_000).toBe(9);
    });
    it('a night shift ends the next day', () => {
        const s = shiftInterval('2026-10-12', '19:00', '07:00', TZ);
        expect((s.end.getTime() - s.start.getTime()) / 3_600_000).toBe(12);
        expect(localDay(s.end, TZ)).toBe('2026-10-13');
    });
    it('detects overlaps but not back-to-back shifts', () => {
        const a = shiftInterval('2026-10-12', '08:00', '13:00', TZ);
        expect(overlaps(a, shiftInterval('2026-10-12', '12:00', '17:00', TZ))).toBe(true);
        expect(overlaps(a, shiftInterval('2026-10-12', '13:00', '17:00', TZ))).toBe(false);
        expect(overlaps(shiftInterval('2026-10-12', '19:00', '07:00', TZ), shiftInterval('2026-10-13', '06:00', '09:00', TZ))).toBe(true);
    });
});

const morning: Shift = { id: 1, ...shiftInterval('2026-10-12', '08:00', '13:00', TZ) };
const evening: Shift = { id: 2, ...shiftInterval('2026-10-12', '15:00', '20:00', TZ) };
const night: Shift = { id: 3, ...shiftInterval('2026-10-12', '19:00', '07:00', TZ) };

describe('matching a punch to a shift', () => {
    it('picks the shift that contains the punch', () => {
        expect(matchShift(at('2026-10-12', '09:00'), [morning, evening], 180)?.id).toBe(1);
        expect(matchShift(at('2026-10-12', '16:00'), [morning, evening], 180)?.id).toBe(2);
    });
    it('picks the nearest start when the punch is between shifts', () => {
        expect(matchShift(at('2026-10-12', '14:30'), [morning, evening], 180)?.id).toBe(2);
        expect(matchShift(at('2026-10-12', '13:30'), [morning, evening], 180)?.id).toBe(1);
    });
    it('a punch long before or after any shift is unscheduled', () => {
        expect(matchShift(at('2026-10-12', '03:00'), [morning], 120)).toBeNull();
        expect(matchShift(at('2026-10-12', '23:00'), [morning], 120)).toBeNull();
    });
    it('a punch after midnight belongs to the night shift that started the evening before', () => {
        expect(matchShift(at('2026-10-13', '01:00'), [night], 180)?.id).toBe(3);
    });
});

describe('late, early and extra minutes respect the grace period', () => {
    const start = at('2026-10-12', '08:00');
    it('within grace is not late', () => {
        expect(lateMinutes(at('2026-10-12', '08:10'), start, 10)).toBe(0);
        expect(lateMinutes(at('2026-10-11', '23:00'), start, 10)).toBe(0);
    });
    it('beyond grace counts from the start, not from the end of the grace period', () => {
        expect(lateMinutes(at('2026-10-12', '08:11'), start, 10)).toBe(11);
        expect(lateMinutes(at('2026-10-12', '09:00'), start, 10)).toBe(60);
    });
    it('early leave and extra time', () => {
        const end = at('2026-10-12', '13:00');
        expect(earlyLeaveMinutes(at('2026-10-12', '12:45'), end, 10)).toBe(15);
        expect(earlyLeaveMinutes(at('2026-10-12', '12:55'), end, 10)).toBe(0);
        expect(extraMinutes(at('2026-10-12', '13:40'), end, 10)).toBe(40);
        expect(extraMinutes(at('2026-10-12', '13:05'), end, 10)).toBe(0);
    });
});

const punch = (id: number, shiftId: number | null, inT: string, outT: string | null, day = '2026-10-12'): Punch => ({ id, shiftId, clockIn: at(day, inT), clockOut: outT ? at(day, outT) : null });
const base = { day: '2026-10-12', graceMinutes: 10, isHoliday: false, onLeave: false, missingClockOutHours: 16 };

describe('what a day looks like', () => {
    const afterwards = at('2026-10-13', '10:00');
    it('present, on time', () => {
        const r = evaluateDay({ ...base, shifts: [morning], punches: [punch(1, 1, '07:58', '13:02')], now: afterwards });
        expect(r).toMatchObject({ status: 'PRESENT', workedMinutes: 304, lateMinutes: 0 });
    });
    it('late', () => {
        const r = evaluateDay({ ...base, shifts: [morning], punches: [punch(1, 1, '08:30', '13:00')], now: afterwards });
        expect(r).toMatchObject({ status: 'LATE', lateMinutes: 30, workedMinutes: 270 });
    });
    it('absent only after the shift has finished; before that it is simply scheduled', () => {
        expect(evaluateDay({ ...base, shifts: [morning], punches: [], now: at('2026-10-12', '10:00') }).status).toBe('SCHEDULED');
        expect(evaluateDay({ ...base, shifts: [morning], punches: [], now: afterwards }).status).toBe('ABSENT');
    });
    it('leave and holidays are not absence, and leave wins over a holiday', () => {
        expect(evaluateDay({ ...base, shifts: [morning], punches: [], onLeave: true, now: afterwards }).status).toBe('ON_LEAVE');
        expect(evaluateDay({ ...base, shifts: [morning], punches: [], isHoliday: true, now: afterwards }).status).toBe('HOLIDAY');
        expect(evaluateDay({ ...base, shifts: [morning], punches: [], onLeave: true, isHoliday: true, now: afterwards }).status).toBe('ON_LEAVE');
    });
    it('no shift and no punch is a day off', () => {
        expect(evaluateDay({ ...base, shifts: [], punches: [], now: afterwards }).status).toBe('DAY_OFF');
    });
    it('a punch with no shift is flagged unscheduled but still counts as present', () => {
        const r = evaluateDay({ ...base, shifts: [], punches: [punch(1, null, '10:00', '12:00')], now: afterwards });
        expect(r).toMatchObject({ status: 'PRESENT', unscheduled: true, workedMinutes: 120 });
    });
    it('split shifts add up', () => {
        const r = evaluateDay({ ...base, shifts: [morning, evening], punches: [punch(1, 1, '08:00', '13:00'), punch(2, 2, '15:00', '20:00')], now: afterwards });
        expect(r).toMatchObject({ status: 'PRESENT', workedMinutes: 600, scheduledMinutes: 600 });
    });
    it('a punch still open is working now; one open for too long is missing its clock-out', () => {
        expect(evaluateDay({ ...base, shifts: [morning], punches: [punch(1, 1, '08:00', null)], now: at('2026-10-12', '10:00') }))
            .toMatchObject({ status: 'PRESENT', workedMinutes: 120 });
        expect(evaluateDay({ ...base, shifts: [morning], punches: [punch(1, 1, '08:00', null)], now: at('2026-10-13', '10:00') }).status).toBe('INCOMPLETE');
    });
    it('extra time and early leave are measured against the shift', () => {
        expect(evaluateDay({ ...base, shifts: [morning], punches: [punch(1, 1, '08:00', '14:00')], now: afterwards }).extraMinutes).toBe(60);
        expect(evaluateDay({ ...base, shifts: [morning], punches: [punch(1, 1, '08:00', '12:00')], now: afterwards }).earlyLeaveMinutes).toBe(60);
    });
});

describe('leave days', () => {
    const none = new Set<string>();
    const noOff = () => false;
    it('counts every calendar day in the range', () => {
        expect(countLeaveDays({ start: '2026-10-12', end: '2026-10-14', dayPart: 'FULL' }, none, noOff)).toBe(3);
    });
    it('does not charge public holidays', () => {
        expect(countLeaveDays({ start: '2026-10-12', end: '2026-10-14', dayPart: 'FULL' }, new Set(['2026-10-13']), noOff)).toBe(2);
    });
    it('does not charge the days off', () => {
        const sunday = (d: string) => weekday(d) === 0;
        expect(countLeaveDays({ start: '2026-10-16', end: '2026-10-19', dayPart: 'FULL' }, none, sunday)).toBe(3);   // Fri, Sat, (Sun off), Mon
    });
    it('a half day counts 0.5, and nothing on a holiday', () => {
        expect(countLeaveDays({ start: '2026-10-12', end: '2026-10-12', dayPart: 'FIRST_HALF' }, none, noOff)).toBe(0.5);
        expect(countLeaveDays({ start: '2026-10-12', end: '2026-10-12', dayPart: 'SECOND_HALF' }, new Set(['2026-10-12']), noOff)).toBe(0);
    });
    it('splits a request across New Year so each year is charged to its own balance', () => {
        expect(daysByYear({ start: '2026-12-30', end: '2027-01-02', dayPart: 'FULL' }, none, noOff)).toEqual({ 2026: 2, 2027: 2 });
    });
});

describe('overlapping leave', () => {
    const r = (start: string, end: string, dayPart: 'FULL' | 'FIRST_HALF' | 'SECOND_HALF' = 'FULL') => ({ start, end, dayPart });
    it('overlapping dates clash; separate dates do not', () => {
        expect(leaveClashes(r('2026-10-12', '2026-10-14'), r('2026-10-14', '2026-10-16'))).toBe(true);
        expect(leaveClashes(r('2026-10-12', '2026-10-13'), r('2026-10-14', '2026-10-16'))).toBe(false);
    });
    it('a morning and an afternoon half day on one date can coexist', () => {
        expect(leaveClashes(r('2026-10-12', '2026-10-12', 'FIRST_HALF'), r('2026-10-12', '2026-10-12', 'SECOND_HALF'))).toBe(false);
    });
    it('two mornings, or a half day with a full day, clash', () => {
        expect(leaveClashes(r('2026-10-12', '2026-10-12', 'FIRST_HALF'), r('2026-10-12', '2026-10-12', 'FIRST_HALF'))).toBe(true);
        expect(leaveClashes(r('2026-10-12', '2026-10-12', 'FIRST_HALF'), r('2026-10-12', '2026-10-12', 'FULL'))).toBe(true);
        expect(leaveClashes(r('2026-10-12', '2026-10-12', 'SECOND_HALF'), r('2026-10-10', '2026-10-14'))).toBe(true);
    });
});

describe('balances', () => {
    it('sets pending requests aside', () => {
        expect(balance(14, 3, 2)).toEqual({ entitled: 14, used: 3, pending: 2, remaining: 9 });
        expect(balance(7, 6.5, 1)).toMatchObject({ remaining: -0.5 });
    });
});
