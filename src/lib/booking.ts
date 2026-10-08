import { pool } from '@/lib/db';
import { asDoctor, nameOf, notify, when } from '@/lib/notify';

export class BookingError extends Error {
    constructor(public status: number, message: string) { super(message); }
}

export interface BookingInput {
    patientId: number;
    doctorId: number;
    date: string;      // YYYY-MM-DD
    timeSlot: string;  // HH:MM, 24h
    reason?: string | null;
    /** Who is making the booking (the patient, or a staff member) - the patient is only told when someone else booked for them */
    actorId?: number;
}

export interface BookingResult {
    appointmentId: number;
    queueNumber: number;
}

/**
 * The single place appointments are created (patient self-service and reception use it), so both enforce
 * the same rules: no past slots, no malformed times, no leave days, no double booking, and a queue number
 * that is unique per doctor per day.
 */
export async function bookAppointment(input: BookingInput): Promise<BookingResult> {
    const { patientId, doctorId, date, timeSlot, reason } = input;

    const todayStr = new Date().toLocaleDateString('en-CA');
    if (date < todayStr) throw new BookingError(400, 'Appointments cannot be booked in the past.');

    const slotMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeSlot);
    if (!slotMatch) throw new BookingError(400, 'Invalid time slot.');

    if (date === todayStr) {
        const now = new Date();
        const slotMinutes = Number(slotMatch[1]) * 60 + Number(slotMatch[2]);
        if (slotMinutes <= now.getHours() * 60 + now.getMinutes()) {
            throw new BookingError(400, 'This time slot has already passed.');
        }
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Serialise bookings per doctor with one row lock. (Locking the slot range instead takes shared gap
        // locks, so concurrent bookings for different slots deadlocked.)
        const [doctor]: any = await connection.execute('SELECT user_id FROM doctors WHERE user_id = ? FOR UPDATE', [doctorId]);
        if (doctor.length === 0) throw new BookingError(404, 'Doctor not found.');

        const [patient]: any = await connection.execute("SELECT id FROM users WHERE id = ? AND role = 'PATIENT'", [patientId]);
        if (patient.length === 0) throw new BookingError(404, 'Patient not found.');

        const [leave]: any = await connection.execute('SELECT id FROM doctor_leaves WHERE doctor_id = ? AND date = ?', [doctorId, date]);
        if (leave.length > 0) throw new BookingError(409, 'The doctor is not available on this date.');

        const [existing]: any = await connection.execute(
            'SELECT id FROM appointments WHERE doctor_id = ? AND date = ? AND time_slot = ? AND status != "CANCELLED"',
            [doctorId, date, timeSlot]
        );
        if (existing.length > 0) throw new BookingError(409, 'This time slot has just been booked. Please choose another.');

        const [rows]: any = await connection.execute(
            'SELECT MAX(queue_number) as maxQueue FROM appointments WHERE doctor_id = ? AND date = ?',
            [doctorId, date]
        );
        const queueNumber = (rows[0].maxQueue || 0) + 1;

        const [result]: any = await connection.execute(
            'INSERT INTO appointments (patient_id, doctor_id, date, time_slot, queue_number, status, reason) VALUES (?, ?, ?, ?, ?, "PENDING", ?)',
            [patientId, doctorId, date, timeSlot, queueNumber, reason || null]
        );

        const patientName = await nameOf(connection, patientId);
        await notify(connection, doctorId, {
            type: 'APPOINTMENT_BOOKED', title: 'New appointment',
            body: `${patientName} booked ${when(date, timeSlot)} (queue #${queueNumber}).`,
            link: '/doctor/appointments',
        });
        if (input.actorId && input.actorId !== patientId) {
            await notify(connection, patientId, {
                type: 'APPOINTMENT_BOOKED', title: 'Appointment booked',
                body: `The front desk booked you with ${asDoctor(await nameOf(connection, doctorId))} on ${when(date, timeSlot)} (queue #${queueNumber}).`,
                link: '/patient/appointments',
            });
        }

        await connection.commit();
        return { appointmentId: result.insertId, queueNumber };
    } catch (err: any) {
        await connection.rollback().catch(() => {});
        if (err instanceof BookingError) throw err;
        if (err?.errno === 1452) throw new BookingError(400, 'Unknown patient or doctor.');
        throw err;
    } finally {
        connection.release();
    }
}
