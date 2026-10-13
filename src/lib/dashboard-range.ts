import { addDays, eachDay, monthRange } from '@/lib/hr-time';

/** The last `n` calendar days ending on `today` (clinic-local), oldest first. */
export function recentDays(today: string, n: number): string[] {
    return eachDay(addDays(today, -(n - 1)), today);
}

/** `n` days centred on today: some days back, some ahead (for "past and upcoming" charts). */
export function daysAround(today: string, back: number, ahead: number): string[] {
    return eachDay(addDays(today, -back), addDays(today, ahead));
}

/** This month so far and the whole of last month, as "YYYY-MM-DD" bounds. */
export function monthComparison(today: string): { thisFrom: string; thisTo: string; lastFrom: string; lastTo: string } {
    const thisMonth = today.slice(0, 7);
    const [y, m] = thisMonth.split('-').map(Number);
    const last = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
    return { thisFrom: monthRange(thisMonth)!.from, thisTo: today, lastFrom: monthRange(last)!.from, lastTo: monthRange(last)!.to };
}

/** Percentage change from `previous` to `current`, or null when there is nothing to compare with. */
export function pctChange(current: number, previous: number): number | null {
    if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
    return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Puts rows keyed by day onto a full list of days, with zero for days that had no rows. */
export function fillDays<T extends Record<string, number>>(days: string[], rows: ({ day: string } & Partial<T>)[], keys: (keyof T & string)[]): ({ day: string } & T)[] {
    const byDay = new Map(rows.map((r) => [r.day, r]));
    return days.map((day) => {
        const row: any = { day };
        for (const k of keys) row[k] = Number(byDay.get(day)?.[k] ?? 0);
        return row;
    });
}

/** "Mon 13" style label for a chart axis. */
export function dayLabel(day: string): string {
    const [y, m, d] = day.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return `${date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })} ${d}`;
}
