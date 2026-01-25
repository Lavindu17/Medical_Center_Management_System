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
        const [docRows]: any = await query(
            'SELECT * FROM doctors WHERE user_id = ?',
            [user.id]
        );

        const [userRows]: any = await query(
            'SELECT name, phone, email FROM users WHERE id = ?',
            [user.id]
        );

        // Fetch Leaves (Future only)
        const leaves = await query(
            'SELECT * FROM doctor_leaves WHERE doctor_id = ? AND date >= CURDATE() ORDER BY date ASC',
            [user.id]
        );

        // Ensure working_days is an array
        let docData = docRows[0];
        if (docData && typeof docData.working_days === 'string') {
            try {
                docData.working_days = JSON.parse(docData.working_days);
            } catch (e) {
                docData.working_days = [];
            }
        }

        return NextResponse.json({
            user: userRows[0],
            doctor: docData,
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
        const { name, phone, consultation_fee, license_number, start_time, end_time, slot_duration, working_days } = body;

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Update User
            await connection.execute(
                'UPDATE users SET name = ?, phone = ? WHERE id = ?',
                [name, phone, user.id]
            );

            // Update Doctor
            // Ensure working_days is stringified if array
            const daysJson = JSON.stringify(working_days);

            await connection.execute(
                `UPDATE doctors 
                 SET consultation_fee = ?, license_number = ?, start_time = ?, end_time = ?, slot_duration = ?, working_days = ?
                 WHERE user_id = ?`,
                [consultation_fee, license_number, start_time, end_time, slot_duration, daysJson, user.id]
            );

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
