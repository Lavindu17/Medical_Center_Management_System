
import { NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

// GET Pending Bills
export async function GET(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        const user = await AuthService.verifyToken(token || '');
        if (!user || user.role !== 'RECEPTIONIST') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        // Fetch bills with patient details
        const bills = await query(`
            SELECT 
                b.*,
                p.name as patient_name,
                p.email as patient_email,
                d.name as doctor_name,
                a.date as appointment_date,
                a.time_slot
            FROM bills b
            JOIN appointments a ON b.appointment_id = a.id
            JOIN users p ON a.patient_id = p.id
            JOIN users d ON a.doctor_id = d.id
            WHERE b.status = 'PENDING'
            ORDER BY b.generated_at DESC
        `);

        return NextResponse.json(bills);
    } catch (error) {
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}

// POST Pay Bill
export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        const user = await AuthService.verifyToken(token || '');
        if (!user || user.role !== 'RECEPTIONIST') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const { bill_id, payment_method } = await req.json();

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // 1. Update Bill
            await connection.execute(
                `UPDATE bills SET status = 'PAID', paid_at = NOW(), payment_method = ? WHERE id = ?`,
                [payment_method, bill_id]
            );

            // 2. Get Appointment ID
            const [billRows]: any = await connection.execute('SELECT appointment_id FROM bills WHERE id = ?', [bill_id]);
            if (billRows.length > 0) {
                const apptId = billRows[0].appointment_id;
                // 3. Mark Appointment as COMPLETED
                await connection.execute("UPDATE appointments SET status = 'COMPLETED' WHERE id = ?", [apptId]);
            }

            await connection.commit();
            return NextResponse.json({ message: 'Payment Processed Successfully' });

        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Payment Error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
