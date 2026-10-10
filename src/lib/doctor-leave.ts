import { query } from '@/lib/db';
import { asDoctor, nameOf, notify, usersWithRole, when } from '@/lib/notify';

const ACTIVE = "('PENDING', 'CONFIRMED', 'CHECKED_IN', 'ARRIVED')";

/**
 * Marks a day as one the doctor cannot be booked, and tells the patients and the front desk when bookings already
 * exist for it. Used both by the doctor's own "block a date" and by approved HR leave.
 * Bookings already made are not cancelled for the doctor.
 */
export async function blockDoctorDay(
    doctorId: number, date: string, reason: string | null, leaveRequestId: number | null = null,
): Promise<{ id: number | null; alreadyOnLeave: boolean; affected: number }> {
    let id: number;
    try {
        const res: any = await query('INSERT INTO doctor_leaves (doctor_id, date, reason, leave_request_id) VALUES (?, ?, ?, ?)', [doctorId, date, reason, leaveRequestId]);
        id = res.insertId;
    } catch (err: any) {
        if (err?.errno === 1062) return { id: null, alreadyOnLeave: true, affected: 0 };
        if (err?.errno === 1054 && leaveRequestId === null) {
            // leave_request_id not migrated yet (20_hr.sql): the doctor's own block works without it
            const res: any = await query('INSERT INTO doctor_leaves (doctor_id, date, reason) VALUES (?, ?, ?)', [doctorId, date, reason]);
            id = res.insertId;
        } else {
            throw err;
        }
    }

    const booked = await query<any[]>(`SELECT DISTINCT patient_id FROM appointments WHERE doctor_id = ? AND date = ? AND status IN ${ACTIVE}`, [doctorId, date]);
    const affected = booked.length;
    if (affected > 0) {
        const doctorName = await nameOf(null, doctorId);
        await notify(null, booked.map((p) => p.patient_id), {
            type: 'DOCTOR_LEAVE', title: 'Your appointment needs rescheduling',
            body: `${asDoctor(doctorName)} is on leave on ${when(date)}. Please book another time.`, link: '/patient/book',
        });
        await notify(null, await usersWithRole(null, 'RECEPTIONIST'), {
            type: 'DOCTOR_LEAVE', title: 'Doctor on leave',
            body: `${asDoctor(doctorName)} is on leave on ${when(date)} with ${affected} booked appointment${affected === 1 ? '' : 's'} to reschedule.`,
            link: '/receptionist/appointments',
        });
    }
    return { id, alreadyOnLeave: false, affected };
}

/** How many bookings a doctor already has on these days (shown to HR before approving leave). */
export async function bookedAppointments(doctorId: number, dates: string[]): Promise<number> {
    if (dates.length === 0) return 0;
    const rows = await query<any[]>(
        `SELECT COUNT(*) AS n FROM appointments WHERE doctor_id = ? AND date IN (${dates.map(() => '?').join(',')}) AND status IN ${ACTIVE}`, [doctorId, ...dates]);
    return Number(rows[0].n);
}

/** Removes the day blocks that came from a leave request (when that leave is cancelled). */
export async function unblockForLeave(leaveRequestId: number): Promise<void> {
    await query('DELETE FROM doctor_leaves WHERE leave_request_id = ?', [leaveRequestId]);
}
