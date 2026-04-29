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

        // Fetch Doctor's Slot Duration
        const [doctor]: any = await query('SELECT slot_duration FROM doctors WHERE user_id = ?', [doctorId]);
        if (!doctor) {
            return NextResponse.json({ message: 'Doctor not found' }, { status: 404 });
        }
        const slotDuration = parseInt(doctor.slot_duration) || 15;

        // Fetch Blocked Dates (Leaves) for the given date
        const leaves: any = await query(
            'SELECT id FROM doctor_leaves WHERE doctor_id = ? AND DATE(date) = ?',
            [doctorId, date]
        );

        // If the date is blocked, return no slots!
        if (leaves.length > 0) {
            return NextResponse.json({
                date,
                doctorId,
                slots: []
            });
        }

        // Determine Day of Week for the given date
        const dateObj = new Date(date || new Date().toISOString());
        const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

        // Fetch Schedules for this specific day
        const sessions: any = await query(
            'SELECT start_time, end_time FROM doctor_schedules WHERE doctor_id = ? AND day = ?',
            [doctorId, dayOfWeek]
        );

        // Generate all possible slots
        const allSlots: string[] = [];

        sessions.forEach((session: any) => {
            let [h, m] = session.start_time.split(':').map(Number);
            const [endH, endM] = session.end_time.split(':').map(Number);
            const endTimeInMinutes = endH * 60 + endM;

            while (true) {
                const currentTimeInMinutes = h * 60 + m;
                if (currentTimeInMinutes >= endTimeInMinutes) break;

                const timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                allSlots.push(timeString);

                // Increment
                m += slotDuration;
                if (m >= 60) {
                    h += Math.floor(m / 60);
                    m = m % 60;
                }
            }
        });

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
