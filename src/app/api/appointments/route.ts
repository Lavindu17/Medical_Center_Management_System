import { NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';
import { z } from 'zod';
import { requireRole } from '@/lib/api-auth';

const appointmentSchema = z.object({
    patientId: z.number(),
    doctorId: z.number(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timeSlot: z.string(),
    reason: z.string().optional(),
});

class BookingError extends Error {
    constructor(public status: number, message: string) { super(message); }
}

export async function POST(req: Request) {
    const auth = await requireRole('PATIENT', 'RECEPTIONIST', 'ADMIN');
    if ('error' in auth) return auth.error;
    const { user } = auth;

    try {
        const body = await req.json();
        const validation = appointmentSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten() }, { status: 400 });
        }

        const { patientId, doctorId, date, timeSlot, reason } = validation.data;

        // Patients can only book for themselves; staff may book on behalf of a patient
        if (user.role === 'PATIENT' && patientId !== user.id) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        // Reject past dates and impossible time slots up front
        const todayStr = new Date().toLocaleDateString('en-CA');
        if (date < todayStr) {
            return NextResponse.json({ message: 'Appointments cannot be booked in the past.' }, { status: 400 });
        }
        const slotMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeSlot);
        if (!slotMatch) {
            return NextResponse.json({ message: 'Invalid time slot.' }, { status: 400 });
        }
        if (date === todayStr) {
            const now = new Date();
            const slotMinutes = Number(slotMatch[1]) * 60 + Number(slotMatch[2]);
            if (slotMinutes <= now.getHours() * 60 + now.getMinutes()) {
                return NextResponse.json({ message: 'This time slot has already passed.' }, { status: 400 });
            }
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Serialise bookings per doctor with one row lock. (Locking the slot range instead takes shared gap
            // locks, so concurrent bookings for different slots deadlocked.)
            const [doctor]: any = await connection.execute('SELECT user_id FROM doctors WHERE user_id = ? FOR UPDATE', [doctorId]);
            if (doctor.length === 0) throw new BookingError(404, 'Doctor not found.');

            const [leave]: any = await connection.execute('SELECT id FROM doctor_leaves WHERE doctor_id = ? AND date = ?', [doctorId, date]);
            if (leave.length > 0) throw new BookingError(409, 'The doctor is not available on this date.');

            const [existing]: any = await connection.execute(
                'SELECT id FROM appointments WHERE doctor_id = ? AND date = ? AND time_slot = ? AND status != "CANCELLED"',
                [doctorId, date, timeSlot]
            );
            if (existing.length > 0) {
                throw new BookingError(409, 'This time slot has just been booked. Please choose another.');
            }

            const [rows]: any = await connection.execute(
                'SELECT MAX(queue_number) as maxQueue FROM appointments WHERE doctor_id = ? AND date = ?',
                [doctorId, date]
            );
            const nextQueue = (rows[0].maxQueue || 0) + 1;

            await connection.execute(
                'INSERT INTO appointments (patient_id, doctor_id, date, time_slot, queue_number, status, reason) VALUES (?, ?, ?, ?, ?, "PENDING", ?)',
                [patientId, doctorId, date, timeSlot, nextQueue, reason || null]
            );

            await connection.commit();

            return NextResponse.json({
                message: 'Appointment booked successfully',
                appointment: { date, timeSlot, queueNumber: nextQueue }
            }, { status: 201 });

        } catch (err: any) {
            await connection.rollback().catch(() => {});
            if (err instanceof BookingError) {
                return NextResponse.json({ message: err.message }, { status: err.status });
            }
            if (err?.errno === 1452) {
                return NextResponse.json({ message: 'Unknown patient or doctor.' }, { status: 400 });
            }
            console.error('Booking Error:', err);
            return NextResponse.json({ message: 'Booking failed. Please try again.' }, { status: 500 });
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Booking Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

// Fetch Appointments (for Patient or Doctor)
export async function GET(req: Request) {
    const auth = await requireRole('PATIENT', 'DOCTOR', 'RECEPTIONIST', 'ADMIN');
    if ('error' in auth) return auth.error;
    const { user } = auth;

    try {
        const { searchParams } = new URL(req.url);
        let patientId = searchParams.get('patientId');
        let doctorId = searchParams.get('doctorId');

        // Scope self-service roles to their own appointments
        if (user.role === 'PATIENT') {
            if (doctorId || (patientId && Number(patientId) !== user.id)) {
                return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
            }
            patientId = String(user.id);
        } else if (user.role === 'DOCTOR') {
            if (patientId || (doctorId && Number(doctorId) !== user.id)) {
                return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
            }
            doctorId = String(user.id);
        }

        let sql = `
      SELECT 
        a.id, 
        DATE_FORMAT(a.date, '%Y-%m-%d') as date, 
        a.time_slot as timeSlot, 
        a.queue_number as queueNumber, 
        a.status,
        a.reason,
        a.patient_id,
        d_user.name as doctorName,
        d.specialization,
        p_user.name as patientName,
        p_user.id as patientUserId
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.user_id
      JOIN users d_user ON d.user_id = d_user.id
      LEFT JOIN users p_user ON a.patient_id = p_user.id
    `;

        const params: any[] = [];

        if (patientId) {
            sql += ' WHERE a.patient_id = ?';
            params.push(patientId);
        } else if (doctorId) {
            sql += ' WHERE a.doctor_id = ?';
            params.push(doctorId);
        } else {
            return NextResponse.json({ message: 'Patient or Doctor ID required' }, { status: 400 });
        }

        sql += ' ORDER BY a.date DESC, a.time_slot ASC';

        const appointments = await query<any[]>(sql, params);
        return NextResponse.json(appointments);

    } catch (error) {
        console.error('Fetch Appointments Error:', error);
        return NextResponse.json({ message: 'Failed to fetch appointments' }, { status: 500 });
    }
}
