import { query } from '@/lib/db';
import { weekday } from '@/lib/hr-time';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export interface DoctorSlots {
    found: boolean;
    onLeave: boolean;
    slotDuration: number;
    /** Every bookable time that day, "HH:MM", in order (empty when the doctor does not work or is on leave) */
    slots: string[];
}

/**
 * The times a doctor can be booked on a day, from their weekly schedule and slot length. The patient screen lists these, and
 * booking checks against the same list, so a request for a time that was never offered (a hand-written request, or a
 * schedule that changed since the page loaded) is refused instead of silently creating an appointment.
 */
export async function slotsFor(doctorId: number | string, date: string): Promise<DoctorSlots> {
    const [doctor]: any = await query('SELECT slot_duration FROM doctors WHERE user_id = ?', [doctorId]);
    if (!doctor) return { found: false, onLeave: false, slotDuration: 15, slots: [] };
    const slotDuration = parseInt(doctor.slot_duration) || 15;

    const leaves: any[] = await query('SELECT id FROM doctor_leaves WHERE doctor_id = ? AND DATE(date) = ?', [doctorId, date]);
    if (leaves.length > 0) return { found: true, onLeave: true, slotDuration, slots: [] };

    // The weekday of a calendar date does not depend on any time zone (parsing "2026-10-13" as a Date does)
    const dayName = DAY_NAMES[weekday(date)];
    const sessions: any[] = await query('SELECT start_time, end_time FROM doctor_schedules WHERE doctor_id = ? AND day = ? AND is_active = 1', [doctorId, dayName]);

    const times = new Set<string>();
    for (const session of sessions) {
        const [sh, sm] = String(session.start_time).split(':').map(Number);
        const [eh, em] = String(session.end_time).split(':').map(Number);
        for (let minutes = sh * 60 + sm; minutes < eh * 60 + em; minutes += slotDuration) {
            times.add(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
        }
    }
    return { found: true, onLeave: false, slotDuration, slots: [...times].sort() };
}
