import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { z } from 'zod';

const cancelSchema = z.object({
    appointmentId: z.number(),
    // In real app, we'd also validate that the patient owns this appointment
});

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const validation = cancelSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
        }

        const { appointmentId } = validation.data;

        // Check availability/status first?
        // For now, simple update
        await query(
            'UPDATE appointments SET status = "CANCELLED" WHERE id = ?',
            [appointmentId]
        );

        return NextResponse.json({ message: 'Appointment cancelled successfully' });

    } catch (error) {
        console.error('Cancel Error:', error);
        return NextResponse.json({ message: 'Failed to cancel appointment' }, { status: 500 });
    }
}
