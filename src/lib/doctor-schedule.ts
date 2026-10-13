import { z } from 'zod';
import { pool, query } from '@/lib/db';
import { isDay, isTime, timeToMinutes } from '@/lib/hr-time';

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export const SLOT_DURATIONS = [5, 10, 15, 20, 30, 45, 60];

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Times must look like 09:00');

export const scheduleSchema = z.object({
    slotDuration: z.coerce.number().int().refine((n) => SLOT_DURATIONS.includes(n), `Slot length must be one of ${SLOT_DURATIONS.join(', ')} minutes`),
    sessions: z.array(z.object({
        day: z.enum(DAYS),
        start: time,
        end: time,
    }).refine((s) => !isTime(s.start) || !isTime(s.end) || timeToMinutes(s.end) > timeToMinutes(s.start), { message: 'A session must end after it starts' })).max(70, 'Too many sessions'),
});
export type ScheduleInput = z.infer<typeof scheduleSchema>;

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date').refine(isDay, 'Choose a valid date');

const ACTIVE = "('PENDING', 'CONFIRMED', 'CHECKED_IN', 'ARRIVED')";

/** Message for the first pair of sessions that overlap on the same day, or null. */
export function findOverlap(sessions: ScheduleInput['sessions']): string | null {
    const perDay = new Map<string, [number, number][]>();
    for (const s of sessions) {
        const ranges = perDay.get(s.day) ?? [];
        const range: [number, number] = [timeToMinutes(s.start), timeToMinutes(s.end)];
        if (ranges.some(([a, b]) => range[0] < b && a < range[1])) return `Working hours overlap on ${s.day}`;
        ranges.push(range);
        perDay.set(s.day, ranges);
    }
    return null;
}

/**
 * Replaces a doctor's weekly hours and slot length. Takes the same doctor lock as booking, so a change and a booking
 * cannot interleave. Existing bookings are never cancelled; the count of those that no longer fit is returned.
 * Returns null when the doctor has no profile.
 */
export async function saveSchedule(doctorId: number, input: ScheduleInput): Promise<{ outsideSchedule: number } | null> {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [docs]: any = await connection.execute('SELECT user_id FROM doctors WHERE user_id = ? FOR UPDATE', [doctorId]);
        if (docs.length === 0) {
            await connection.rollback();
            return null;
        }
        await connection.execute('UPDATE doctors SET slot_duration = ? WHERE user_id = ?', [input.slotDuration, doctorId]);
        await connection.execute('DELETE FROM doctor_schedules WHERE doctor_id = ?', [doctorId]);
        for (const s of input.sessions) {
            await connection.execute(
                'INSERT INTO doctor_schedules (doctor_id, day, start_time, end_time) VALUES (?, ?, ?, ?)',
                [doctorId, s.day, s.start.slice(0, 5) + ':00', s.end.slice(0, 5) + ':00']);
        }
        const [upcoming]: any = await connection.execute(
            `SELECT DAYNAME(date) AS day, time_slot FROM appointments WHERE doctor_id = ? AND date >= CURDATE() AND status IN ${ACTIVE}`, [doctorId]);
        const outsideSchedule = upcoming.filter((a: any) => {
            const t = timeToMinutes(String(a.time_slot));
            return !input.sessions.some((s) => s.day === a.day && t >= timeToMinutes(s.start) && t < timeToMinutes(s.end));
        }).length;
        await connection.commit();
        return { outsideSchedule };
    } catch (err) {
        await connection.rollback().catch(() => {});
        throw err;
    } finally {
        connection.release();
    }
}

/** Active bookings per day for a set of dates (for the time-off preview). */
export async function bookingsOn(doctorId: number, dates: string[]): Promise<Record<string, number>> {
    if (dates.length === 0) return {};
    const rows = await query<any[]>(
        `SELECT DATE_FORMAT(date, '%Y-%m-%d') AS d, COUNT(*) AS n FROM appointments
         WHERE doctor_id = ? AND date IN (${dates.map(() => '?').join(',')}) AND status IN ${ACTIVE} GROUP BY date`, [doctorId, ...dates]);
    return Object.fromEntries(rows.map((r) => [r.d, Number(r.n)]));
}
