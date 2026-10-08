/** Parses "YYYY-MM-DD" as a local calendar day (new Date("2030-01-07") would be UTC midnight and can land on the previous day). */
export function parseDay(value: string): Date {
    const [y, m, d] = value.slice(0, 10).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
}

function startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Whole calendar days from `now` to `value` (0 = today, 1 = tomorrow, negative = past). */
export function daysFromToday(value: string, now: Date = new Date()): number {
    return Math.round((parseDay(value).getTime() - startOfDay(now).getTime()) / 86_400_000);
}

/** "Today", "Tomorrow", "Yesterday", or "Tue 14 Oct" (with the year when it is not the current one). */
export function friendlyDay(value: string, now: Date = new Date()): string {
    const diff = daysFromToday(value, now);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    const day = parseDay(value);
    // Assembled by hand: Intl adds a comma after the weekday only when a year is present, which looked inconsistent
    const weekday = day.toLocaleDateString('en-GB', { weekday: 'short' });
    const dayMonth = day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const year = day.getFullYear() !== now.getFullYear() ? ` ${day.getFullYear()}` : '';
    return `${weekday} ${dayMonth}${year}`;
}

/** "10:00:00" -> "10:00" */
export function shortTime(value: string): string {
    return String(value).slice(0, 5);
}

/** "Good morning" / "Good afternoon" / "Good evening" for the visitor's local time. */
export function greeting(now: Date = new Date()): string {
    const hour = now.getHours();
    if (hour < 5) return 'Hello';
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
}

/** First name for a greeting, ignoring a leading title ("Dr. Jane Doe" -> "Jane"). */
export function firstName(name?: string | null): string {
    const words = (name ?? '').trim().replace(/^(dr|mr|mrs|ms|miss|prof)\.?\s+/i, '').split(/\s+/);
    return words[0] ?? '';
}

function toDate(value: Date | string | number | null | undefined): Date | null {
    if (value === null || value === undefined || value === '') return null;
    // A bare "YYYY-MM-DD" is a calendar day, not an instant: keep it on that day in every time zone
    const d = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseDay(value) : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** "8 Oct 2026". The same everywhere, independent of the browser's language setting. "-" when there is no date. */
export function formatDate(value: Date | string | number | null | undefined): string {
    const d = toDate(value);
    return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
}

/** "8 Oct 2026, 14:30" */
export function formatDateTime(value: Date | string | number | null | undefined): string {
    const d = toDate(value);
    if (!d) return '-';
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${formatDate(d)}, ${time}`;
}
