/**
 * Clinic-local dates and times for the HR module. Shifts are written in the clinic's own time ("08:00 to 17:00 on
 * 12 Oct"); punches are stored as UTC instants. These helpers convert between the two for one named time zone,
 * so the answer does not depend on where the server runs.
 */

export const DEFAULT_TIMEZONE = 'Asia/Colombo';

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

export function isDay(value: unknown): value is string {
    if (typeof value !== 'string' || !DAY.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isTime(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const m = TIME.exec(value);
    return Boolean(m) && Number(m![1]) < 24 && Number(m![2]) < 60;
}

/** "8:05" or "08:05:00" becomes "08:05". */
export function normTime(value: string): string {
    const m = TIME.exec(value)!;
    return `${m[1].padStart(2, '0')}:${m[2]}`;
}

export function timeToMinutes(value: string): number {
    const m = TIME.exec(value)!;
    return Number(m[1]) * 60 + Number(m[2]);
}

/** Offset of `tz` from UTC at that instant, in milliseconds (positive east of Greenwich). */
function offsetMs(instant: Date, tz: string): number {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(instant);
    const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The UTC instant at which the clinic's wall clock shows `day` `time`. */
export function zonedToUtc(day: string, time: string, tz: string = DEFAULT_TIMEZONE): Date {
    const [y, mo, d] = day.split('-').map(Number);
    const [h, mi] = normTime(time).split(':').map(Number);
    const wall = Date.UTC(y, mo - 1, d, h, mi);
    // Two passes settle the offset around daylight-saving changes (Sri Lanka has none, but other clinics might)
    let guess = wall - offsetMs(new Date(wall), tz);
    guess = wall - offsetMs(new Date(guess), tz);
    return new Date(guess);
}

/** The clinic-local calendar day an instant falls on. */
export function localDay(instant: Date, tz: string = DEFAULT_TIMEZONE): string {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
    return p;   // en-CA is YYYY-MM-DD
}

export function localTime(instant: Date, tz: string = DEFAULT_TIMEZONE): string {
    return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant);
}

export function addDays(day: string, n: number): string {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekday(day: string): number {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const dayMs = (day: string) => { const [y, m, d] = day.split('-').map(Number); return Date.UTC(y, m - 1, d); };

export function daysBetween(from: string, to: string): number {
    return Math.round((dayMs(to) - dayMs(from)) / 86_400_000);
}

export function eachDay(from: string, to: string): string[] {
    const out: string[] = [];
    for (let d = from, guard = 0; d <= to && guard < 400; d = addDays(d, 1), guard++) out.push(d);
    return out;
}

/** Monday of the week containing `day`. */
export function weekStart(day: string): string {
    const wd = weekday(day);
    return addDays(day, wd === 0 ? -6 : 1 - wd);
}

export interface Interval { start: Date; end: Date }

/** A shift as real instants. An end at or before the start means it finishes the next day (a night shift). */
export function shiftInterval(day: string, start: string, end: string, tz: string = DEFAULT_TIMEZONE): Interval {
    const s = zonedToUtc(day, start, tz);
    let e = zonedToUtc(day, end, tz);
    if (e.getTime() <= s.getTime()) e = zonedToUtc(addDays(day, 1), end, tz);
    return { start: s, end: e };
}

export const minutesBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / 60_000);

/** First and last day of a "YYYY-MM" month, or null when the text is not a month. */
export function monthRange(month: string): { from: string; to: string } | null {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
    const from = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    return { from, to: addDays(next, -1) };
}
