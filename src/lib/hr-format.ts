/** Formatting helpers for the HR screens (safe for the browser). All times are shown in the clinic's time zone. */

export function minutesText(total: number): string {
    const m = Math.max(0, Math.round(total));
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (h === 0) return `${r}m`;
    return r === 0 ? `${h}h` : `${h}h ${String(r).padStart(2, '0')}m`;
}

/** "14:05" in the clinic's zone for an ISO instant. */
export function clockText(iso: string | null | undefined, tz: string): string {
    if (!iso) return '-';
    return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

/** "Mon 12 Oct" for a YYYY-MM-DD day. */
export function dayText(day: string): string {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
}

export function monthText(month: string): string {
    const [y, m] = month.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' });
}

export function shiftText(s: { start: string; end: string }): string {
    return `${s.start}-${s.end}`;
}

export const ROLE_LABEL: Record<string, string> = {
    DOCTOR: 'Doctor', PHARMACIST: 'Pharmacist', LAB_ASSISTANT: 'Lab assistant', RECEPTIONIST: 'Receptionist', ADMIN: 'Administrator', HR_MANAGER: 'HR manager',
};

/** Adds or subtracts months from "YYYY-MM". */
export function shiftMonth(month: string, delta: number): string {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function addDaysText(day: string, n: number): string {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function mondayOf(day: string): string {
    const [y, m, d] = day.split('-').map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return addDaysText(day, wd === 0 ? -6 : 1 - wd);
}

/** Today in the browser is only used to choose a starting view; the server decides everything that matters. */
export function todayGuess(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
