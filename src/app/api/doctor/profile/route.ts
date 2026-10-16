import { NextResponse } from 'next/server';
import { audit, changedFields } from '@/lib/audit';
import { z } from 'zod';
import { query, pool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

// Working hours, slot length and time off are managed by the administrator (/api/admin/doctors/[id]/schedule)

const profileSchema = z.object({
    name: z.string().trim().min(2, 'Name is required').max(255),
    phone: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.string().trim().max(20).nullable()),
    consultation_fee: z.coerce.number({ message: 'Consultation fee must be a number' }).min(0, 'Consultation fee cannot be negative').max(10_000_000),
    license_number: z.string().trim().min(1, 'License number is required').max(50),
    specialization: z.string().trim().min(1).max(100).optional(),
});

export async function GET() {
    const auth = await requirePermission('doctor.profile', 'view');
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
    const auth = await requirePermission('doctor.profile', 'change');
    if ('error' in auth) return auth.error;
    const { user } = auth;

    try {
        const parsed = profileSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ message: parsed.error.issues[0]?.message || 'Invalid input', errors: parsed.error.flatten() }, { status: 400 });
        }
        const p = parsed.data;

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
                'UPDATE doctors SET consultation_fee = ?, license_number = ? WHERE user_id = ?',
                [p.consultation_fee, p.license_number, user.id]);

            await connection.commit();
            await audit(user, { action: 'UPDATE', entity: 'DOCTOR_PROFILE', entityId: user.id, });
            return NextResponse.json({ message: 'Updated' });
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
