import { NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

// Helper to get current doctor
async function getDoctor() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;
    const user = await AuthService.verifyToken(token);
    if (!user || user.role !== 'DOCTOR') return null;
    return user;
}

export async function GET() {
    try {
        const user = await getDoctor();
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        // Fetch Profile
        const docRows: any = await query(
            'SELECT * FROM doctors WHERE user_id = ?',
            [user.id]
        );

        const userRows: any = await query(
            'SELECT name, phone, email FROM users WHERE id = ?',
            [user.id]
        );

        // Fetch Schedules
        const schedules: any = await query(
            'SELECT * FROM doctor_schedules WHERE doctor_id = ? ORDER BY day ASC, start_time ASC',
            [user.id]
        );

        // Fetch Leaves (Future only) - normalize date format
        const leaves = await query(
            'SELECT id, doctor_id, DATE_FORMAT(date, "%Y-%m-%d") as date, reason FROM doctor_leaves WHERE doctor_id = ? AND date >= CURDATE() ORDER BY date ASC',
            [user.id]
        );

        return NextResponse.json({
            user: userRows[0],
            doctor: docRows[0],
            schedules: schedules,
            leaves: leaves
        });

    } catch (error) {
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const user = await getDoctor();
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const body = await req.json();

        // Handle Profile Update vs LEAVES (Leaves handled in separate route, so this is just profile + schedule)
        const { name, phone, consultation_fee, license_number, slot_duration, schedules } = body;

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Update User
            await connection.execute(
                'UPDATE users SET name = ?, phone = ? WHERE id = ?',
                [name, phone, user.id]
            );

            // Update Doctor (Profile Settings)
            // Note: start_time, end_time, working_days are deprecated but we might keep them or ignore them. 
            // We update slot_duration.
            await connection.execute(
                `UPDATE doctors 
                 SET consultation_fee = ?, license_number = ?, slot_duration = ?
                 WHERE user_id = ?`,
                [consultation_fee, license_number, slot_duration, user.id]
            );

            // Update Schedules
            // 1. Delete existing
            await connection.execute('DELETE FROM doctor_schedules WHERE doctor_id = ?', [user.id]);

            // 2. Insert new
            if (schedules && Array.isArray(schedules) && schedules.length > 0) {
                // Prepare Insert Statement
                // Input format expected: [{ days: ['Monday', 'Tuesday'], start_time: '09:00', end_time: '17:00' }]
                // OR flattened: [{ day: 'Monday', start_time: '09:00', end_time: '17:00' }]
                // Let's assume the Frontend sends FLATTENED rows or BLOCKS.
                // Plan said Frontend will send Blocks, but Backend usually wants Rows or expands them.
                // Let's make Backend robust: Expand Blocks if needed, or assume Frontend sends Blocks and we expand loop.

                // Let's assume input is "Blocks" as per plan: `{ days, start_time, end_time }`
                for (const block of schedules) {
                    if (block.days && Array.isArray(block.days)) {
                        for (const day of block.days) {
                            await connection.execute(
                                'INSERT INTO doctor_schedules (doctor_id, day, start_time, end_time) VALUES (?, ?, ?, ?)',
                                [user.id, day, block.start_time, block.end_time]
                            );
                        }
                    }
                }
            }

            await connection.commit();
            return NextResponse.json({ message: 'Updated' });

        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
