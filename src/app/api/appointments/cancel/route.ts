import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { z } from 'zod';
import { requireRole } from '@/lib/api-auth';
import { nameOf, notify, when } from '@/lib/notify';

const cancelSchema = z.object({
    appointmentId: z.number(),
    // In real app, we'd also validate that the patient owns this appointment
});

export async function PUT(req: Request) {
    const auth = await requireRole('PATIENT', 'DOCTOR', 'RECEPTIONIST', 'ADMIN');
    if ('error' in auth) return auth.error;
    const { user } = auth;

    try {
        const body = await req.json();
        const validation = cancelSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
        }

        const { appointmentId } = validation.data;

        const rows = await query<any[]>("SELECT patient_id, doctor_id, status, DATE_FORMAT(date, '%Y-%m-%d') AS date, time_slot FROM appointments WHERE id = ?", [appointmentId]);
        if (rows.length === 0) {
            return NextResponse.json({ message: 'Appointment not found' }, { status: 404 });
        }
        const appt = rows[0];
        if ((user.role === 'PATIENT' && appt.patient_id !== user.id) || (user.role === 'DOCTOR' && appt.doctor_id !== user.id)) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }
        if (!['PENDING', 'CONFIRMED', 'CHECKED_IN', 'ARRIVED'].includes(appt.status)) {
            return NextResponse.json({ message: `A ${String(appt.status).toLowerCase()} appointment cannot be cancelled` }, { status: 409 });
        }

        await query(
            'UPDATE appointments SET status = "CANCELLED" WHERE id = ?',
            [appointmentId]
        );

        // Tell the people involved, except the one who just did it
        const slot = when(appt.date, appt.time_slot);
        if (user.id !== appt.doctor_id) {
            await notify(null, appt.doctor_id, {
                type: 'APPOINTMENT_CANCELLED', title: 'Appointment cancelled',
                body: `${await nameOf(null, appt.patient_id)}'s appointment on ${slot} was cancelled.`, link: '/doctor/appointments',
            });
        }
        if (user.id !== appt.patient_id) {
            await notify(null, appt.patient_id, {
                type: 'APPOINTMENT_CANCELLED', title: 'Appointment cancelled',
                body: `Your appointment on ${slot} was cancelled.`, link: '/patient/appointments',
            });
        }

        return NextResponse.json({ message: 'Appointment cancelled successfully' });

    } catch (error) {
        console.error('Cancel Error:', error);
        return NextResponse.json({ message: 'Failed to cancel appointment' }, { status: 500 });
    }
}
