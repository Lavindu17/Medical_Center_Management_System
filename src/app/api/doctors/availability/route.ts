import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { z } from 'zod';

const availabilitySchema = z.object({
    doctorId: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const doctorId = searchParams.get('doctorId');
        const date = searchParams.get('date');

        const validation = availabilitySchema.safeParse({ doctorId, date });
        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
        }

        // Define Sessions
        const sessions = [
            { start: '06:30', end: '08:00' },
            { start: '17:30', end: '22:00' } // 5:30 PM to 10:00 PM
        ];
        const slotDuration = 10; // minutes

        // Generate all possible slots
        const allSlots: string[] = [];

        sessions.forEach(session => {
            let [h, m] = session.start.split(':').map(Number);
            const [endH, endM] = session.end.split(':').map(Number);
            const endTimeInMinutes = endH * 60 + endM;

            while (true) {
                const currentTimeInMinutes = h * 60 + m;
                if (currentTimeInMinutes >= endTimeInMinutes) break;

                const timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                allSlots.push(timeString);

                // Increment
                m += slotDuration;
                if (m >= 60) {
                    h += 1;
                    m -= 60;
                }
            }
        });

        // Fetch existing appointments
        const existing = await query<any[]>(
            'SELECT time_slot FROM appointments WHERE doctor_id = ? AND date = ? AND status != "CANCELLED"',
            [doctorId, date]
        );
        const bookedSlots = new Set(existing.map((a: any) => a.time_slot.slice(0, 5)));

        // Return all slots with availability status
        const slotsWithStatus = allSlots.map(time => ({
            time,
            available: !bookedSlots.has(time)
        }));

        return NextResponse.json({
            date,
            doctorId,
            slots: slotsWithStatus
        });

    } catch (error) {
        console.error('Availability Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
