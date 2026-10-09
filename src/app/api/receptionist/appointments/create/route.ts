import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { z } from 'zod';
import { requireRole } from '@/lib/api-auth';
import { bookAppointment, BookingError } from '@/lib/booking';

const schema = z.object({
    patient_id: z.coerce.number().int().positive(),
    doctor_id: z.coerce.number().int().positive(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time_slot: z.string(),
    reason: z.string().max(1000).optional(),
});

export async function POST(req: Request) {
    const auth = await requireRole('RECEPTIONIST', 'ADMIN');
    if ('error' in auth) return auth.error;
    const { user } = auth;

    try {
        const parsed = schema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ message: 'Missing or invalid fields', errors: parsed.error.flatten() }, { status: 400 });
        }
        const { patient_id, doctor_id, date, time_slot, reason } = parsed.data;

        // Same rules, locking and queue numbering as patient self-service booking
        const { appointmentId, queueNumber } = await bookAppointment({
            patientId: patient_id, doctorId: doctor_id, date, timeSlot: time_slot, reason, actorId: user.id,
        });

        await audit(user, { action: 'CREATE', entity: 'APPOINTMENT', entityId: appointmentId, patientId: patient_id, details: { doctorId: doctor_id, date, timeSlot: time_slot, bookedBy: 'RECEPTIONIST' } });
        return NextResponse.json({
            message: 'Appointment Booked',
            appointmentId,
            queue_number: queueNumber,
        });
    } catch (error) {
        if (error instanceof BookingError) {
            return NextResponse.json({ message: error.message }, { status: error.status });
        }
        console.error('Reception Booking Error:', error);
        return NextResponse.json({ message: 'Booking failed. Please try again.' }, { status: 500 });
    }
}
