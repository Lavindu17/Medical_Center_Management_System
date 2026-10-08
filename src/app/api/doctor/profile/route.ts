import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, pool } from '@/lib/db';
import { requireRole } from '@/lib/api-auth';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const SLOT_DURATIONS = [5, 10, 15, 20, 30, 45, 60];

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Times must look like 09:00');
const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

const profileSchema = z.object({
    name: z.string().trim().min(2, 'Name is required').max(255),
    phone: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.string().trim().max(20).nullable()),
    consultation_fee: z.coerce.number({ message: 'Consultation fee must be a number' }).min(0, 'Consultation fee cannot be negative').max(10_000_000),
    license_number: z.string().trim().min(1, 'License number is required').max(50),
    specialization: z.string().trim().min(1).max(100).optional(),
    slot_duration: z.coerce.number().int().refine((n) => SLOT_DURATIONS.includes(n), `Slot length must be one of ${SLOT_DURATIONS.join(', ')} minutes`),
    schedules: z.array(z.object({
        days: z.array(z.enum(DAYS)).min(1, 'Choose at least one day for each working block'),
        start_time: time,
        end_time: time,
    }).refine((b) => toMinutes(b.end_time) > toMinutes(b.start_time), { message: 'A working block must end after it starts' })).default([]),
});

export async function GET() {
    const auth = await requireRole('DOCTOR');
    if ('error' in auth) return auth.error;
    const { user } = auth;

    try {
        const docRows = await query<any[]>('SELECT * FROM doctors WHERE user_id = ?', [user.id]);
        if (docRows.length === 0) {
            return NextResponse.json({ message: 'Doctor profile not found' }, { status: 404 });
        }
        const userRows = await query<any[]>('SELECT name, phone, email FROM users WHERE id = ?', [user.id]);
        const schedules = await query<any[]>('SELECT * FROM doctor_schedules WHERE doctor_id = ? ORDER BY day ASC, start_time ASC', [user.id]);
        // Future leave days only, with a normalised date format
        const leaves = await query<any[]>(
            'SELECT id, doctor_id, DATE_FORMAT(date, "%Y-%m-%d") as date, reason FROM doctor_leaves WHERE doctor_id = ? AND date >= CURDATE() ORDER BY date ASC',
            [user.id]);

        return NextResponse.json({ user: userRows[0], doctor: docRows[0], schedules, leaves });
    } catch (error) {
        console.error('Doctor profile GET error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const auth = await requireRole('DOCTOR');
    if ('error' in auth) return auth.error;
    const { user } = auth;

    try {
        const parsed = profileSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ message: parsed.error.issues[0]?.message || 'Invalid input', errors: parsed.error.flatten() }, { status: 400 });
        }
        const p = parsed.data;

        // Two blocks on the same day must not overlap (they would produce duplicate slots)
        const perDay = new Map<string, [number, number][]>();
        for (const block of p.schedules) {
            for (const day of new Set(block.days)) {
                const ranges = perDay.get(day) ?? [];
                const range: [number, number] = [toMinutes(block.start_time), toMinutes(block.end_time)];
                if (ranges.some(([s, e]) => range[0] < e && s < range[1])) {
                    return NextResponse.json({ message: `Working hours overlap on ${day}` }, { status: 400 });
                }
                ranges.push(range);
                perDay.set(day, ranges);
            }
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Same lock new bookings take, so a schedule change and a booking cannot interleave
            const [docs]: any = await connection.execute('SELECT user_id FROM doctors WHERE user_id = ? FOR UPDATE', [user.id]);
            if (docs.length === 0) {
                await connection.rollback();
                return NextResponse.json({ message: 'Doctor profile not found' }, { status: 404 });
            }

            await connection.execute('UPDATE users SET name = ?, phone = ? WHERE id = ?', [p.name, p.phone, user.id]);
            if (p.specialization) {
                await connection.execute('UPDATE doctors SET specialization = ? WHERE user_id = ?', [p.specialization, user.id]);
            }
            await connection.execute(
                'UPDATE doctors SET consultation_fee = ?, license_number = ?, slot_duration = ? WHERE user_id = ?',
                [p.consultation_fee, p.license_number, p.slot_duration, user.id]);

            await connection.execute('DELETE FROM doctor_schedules WHERE doctor_id = ?', [user.id]);
            for (const block of p.schedules) {
                for (const day of new Set(block.days)) {
                    await connection.execute(
                        'INSERT INTO doctor_schedules (doctor_id, day, start_time, end_time) VALUES (?, ?, ?, ?)',
                        [user.id, day, block.start_time.slice(0, 5) + ':00', block.end_time.slice(0, 5) + ':00']);
                }
            }

            // Existing bookings are never cancelled silently; report how many no longer fit so the doctor can act
            const [upcoming]: any = await connection.execute(
                `SELECT DAYNAME(date) AS day, time_slot FROM appointments
                 WHERE doctor_id = ? AND date >= CURDATE() AND status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'ARRIVED')`, [user.id]);
            const outsideSchedule = upcoming.filter((a: any) => {
                const t = toMinutes(String(a.time_slot));
                return !(perDay.get(a.day) ?? []).some(([s, e]) => t >= s && t < e);
            }).length;

            await connection.commit();
            return NextResponse.json({ message: 'Updated', outsideSchedule });
        } catch (err) {
            await connection.rollback().catch(() => {});
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Doctor profile POST error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
