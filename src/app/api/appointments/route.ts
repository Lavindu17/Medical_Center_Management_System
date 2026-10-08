import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { z } from 'zod';
import { requireRole } from '@/lib/api-auth';
import { bookAppointment, BookingError } from '@/lib/booking';

const appointmentSchema = z.object({
    patientId: z.number().int().positive(),
    doctorId: z.number().int().positive(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timeSlot: z.string(),
    reason: z.string().max(1000).optional(),
});

export async function POST(req: Request) {
    const auth = await requireRole('PATIENT', 'RECEPTIONIST', 'ADMIN');
    if ('error' in auth) return auth.error;
    const { user } = auth;

    try {
        const validation = appointmentSchema.safeParse(await req.json().catch(() => null));
        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten() }, { status: 400 });
        }
        const { patientId, doctorId, date, timeSlot, reason } = validation.data;

        // Patients can only book for themselves; staff may book on behalf of a patient
        if (user.role === 'PATIENT' && patientId !== user.id) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        const { appointmentId, queueNumber } = await bookAppointment({ patientId, doctorId, date, timeSlot, reason, actorId: user.id });
        return NextResponse.json({
            message: 'Appointment booked successfully',
            appointment: { id: appointmentId, date, timeSlot, queueNumber }
        }, { status: 201 });
    } catch (err: any) {
        if (err instanceof BookingError) {
            return NextResponse.json({ message: err.message }, { status: err.status });
        }
        console.error('Booking Error:', err);
        return NextResponse.json({ message: 'Booking failed. Please try again.' }, { status: 500 });
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
