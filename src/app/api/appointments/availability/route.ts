import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { z } from 'zod';

const availabilitySchema = z.object({
    doctorId: z.string(), // Parse as string from searchParams, convert later
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const doctorIdParam = searchParams.get('doctorId');
        const dateParam = searchParams.get('date');

        if (!doctorIdParam || !dateParam) {
            return NextResponse.json({ message: 'Missing parameters' }, { status: 400 });
        }

        const valid = availabilitySchema.safeParse({ doctorId: doctorIdParam, date: dateParam });

        if (!valid.success) {
            return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
        }

        const { doctorId, date } = valid.data;
        const docId = parseInt(doctorId);

        // 1. Get Month/Day to check Schedule (Parse manually to avoid UTC/Local shifts)
        const [year, month, day] = date.split('-').map(Number);
        const targetDate = new Date(year, month - 1, day); // Local Midnight

        // Days: Sunday=0 ... Saturday=6
        // Our DB uses ENUM('Monday',...)
        const daysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = daysMap[targetDate.getDay()];

        // 2. Check if Doctor is on Leave
        const leaves: any[] = await query(
            'SELECT * FROM doctor_leaves WHERE doctor_id = ? AND date = ?',
            [docId, date]
        );

        if (leaves.length > 0) {
            return NextResponse.json({
                available: false,
                reason: 'Doctor is on leave',
                slots: []
            });
        }

        // 3. Get Doctor Config (Slot Duration)
        const doctorRows: any[] = await query(
            'SELECT slot_duration FROM doctors WHERE user_id = ?',
            [docId]
        );

        if (doctorRows.length === 0) {
            return NextResponse.json({ message: 'Doctor not found' }, { status: 404 });
        }

        const slotDuration = doctorRows[0].slot_duration || 15;

        // 4. Get Schedules for this Day
        const schedules: any[] = await query(
            'SELECT start_time, end_time FROM doctor_schedules WHERE doctor_id = ? AND day = ? ORDER BY start_time ASC',
            [docId, dayName]
        );

        if (schedules.length === 0) {
            // Fallback to legacy check if you want, but likely we rely on this table now.
            // If no schedule found, return empty slots.
            return NextResponse.json({
                available: true,
                reason: 'No schedule configured for this day',
                slots: []
            });
        }

        // 5. Get Existing Bookings
        const bookings: any[] = await query(
            'SELECT time_slot FROM appointments WHERE doctor_id = ? AND date = ? AND status != "CANCELLED"',
            [docId, date]
        );
        const bookedTimes = new Set(bookings.map(b => b.time_slot.slice(0, 5))); // Ensure format HH:MM

        // 6. Generate Slots
        const slots: { time: string, status: 'available' | 'booked' }[] = [];

        for (const schedule of schedules) {
            // schedule.start_time is "HH:MM:SS" usually
            let current = parseTime(schedule.start_time);
            const end = parseTime(schedule.end_time);

            while (current < end) {
                const timeStr = formatTime(current);

                // Add slot
                slots.push({
                    time: timeStr,
                    status: bookedTimes.has(timeStr) ? 'booked' : 'available'
                });

                // Increment
                current += slotDuration;
            }
        }

        return NextResponse.json({ available: true, slots });

    } catch (error) {
        console.error('Availability Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

// Helpers
function parseTime(timeStr: string): number {
    // "09:00:00" or "09:00" -> minutes from midnight
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function formatTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
