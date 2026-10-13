import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { z } from 'zod';
import { slotsFor } from '@/lib/availability';

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

        const { found, onLeave, slots: allSlots } = await slotsFor(doctorId!, date!);
        if (!found) {
            return NextResponse.json({ message: 'Doctor not found' }, { status: 404 });
        }
        // A doctor on leave, or not working that day, has no slots
        if (onLeave || allSlots.length === 0) {
            return NextResponse.json({ date, doctorId, slots: [] });
        }

        // Fetch existing appointments
        const existing = await query<any[]>(
            'SELECT time_slot FROM appointments WHERE doctor_id = ? AND date = ? AND status != "CANCELLED"',
            [doctorId, date]
        );
        const bookedSlots = new Set(existing.map((a: any) => a.time_slot.slice(0, 5)));

        // Time Validation Logic for Same-Day Bookings
        const now = new Date();
        const todayStr = now.toLocaleDateString('en-CA'); // 'YYYY-MM-DD' in local timezone
        const isToday = date === todayStr;
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();

        // Return all slots with availability status
        const slotsWithStatus = allSlots.map(time => {
            let available = !bookedSlots.has(time);

            // If it's today, check if the time has already passed
            if (isToday && available) {
                const [slotH, slotM] = time.split(':').map(Number);
                if (slotH < currentHours || (slotH === currentHours && slotM <= currentMinutes)) {
                    available = false;
                }
            }

            return {
                time,
                available
            };
        });

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
