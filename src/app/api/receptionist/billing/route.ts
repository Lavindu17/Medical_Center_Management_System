import { NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

// GET Pending Bills — enriched with itemized breakdown
export async function GET(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        const user = await AuthService.verifyToken(token || '');
        if (!user || user.role !== 'RECEPTIONIST') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status') || 'PENDING'; // PENDING | PAID | ALL

        const whereClause = status === 'ALL' ? '' : `WHERE b.status = '${status === 'PAID' ? 'PAID' : 'PENDING'}'`;

        const bills: any = await query(`
            SELECT 
                b.id, b.status, b.payment_method,
                b.doctor_fee, b.service_charge, b.pharmacy_total, b.lab_total, b.total_amount,
                b.generated_at, b.paid_at,
                a.id as appointment_id, a.date as appointment_date, a.time_slot,
                p.id as patient_id, p.name as patient_name, p.email as patient_email, p.phone as patient_phone,
                d.name as doctor_name, doc.specialization,
                receptionist.name as paid_by_name
            FROM bills b
            JOIN appointments a ON b.appointment_id = a.id
            JOIN users p ON a.patient_id = p.id
            JOIN users d ON a.doctor_id = d.id
            JOIN doctors doc ON doc.user_id = d.id
            LEFT JOIN users receptionist ON receptionist.id = b.paid_by
            ${whereClause}
            ORDER BY b.generated_at DESC
        `);

        // Enrich each bill with itemized line items
        for (const bill of bills as any[]) {
            // Lab line items
            const labItems: any = await query(`
                SELECT lt.name, lt.price, lr.status as lab_status
                FROM lab_requests lr
                JOIN lab_tests lt ON lt.id = lr.test_id
                WHERE lr.appointment_id = ?
            `, [bill.appointment_id]);
            bill.lab_items = labItems;

            // Medicine line items (dispensed)
            const medItems: any = await query(`
                SELECT m.name as medicine_name, m.unit, pi.dispensed_quantity as qty,
                       pi.status as item_status,
                       ib.selling_price as unit_price,
                       (pi.dispensed_quantity * ib.selling_price) as line_total
                FROM prescription_items pi
                JOIN prescriptions pr ON pr.id = pi.prescription_id
                JOIN medicines m ON m.id = pi.medicine_id
                LEFT JOIN (
                    SELECT medicine_id, MAX(selling_price) as selling_price 
                    FROM inventory_batches 
                    WHERE expiry_date >= CURDATE() 
                    GROUP BY medicine_id
                ) ib ON ib.medicine_id = pi.medicine_id
                WHERE pr.appointment_id = ?
                  AND pi.dispensed_quantity > 0
            `, [bill.appointment_id]);
            bill.medicine_items = medItems;
        }

        return NextResponse.json(bills);
    } catch (error) {
        console.error('Billing GET Error:', error);
        return NextResponse.json({ message: 'Error fetching bills' }, { status: 500 });
    }
}

// POST Mark Payment as Paid
export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        const user = await AuthService.verifyToken(token || '');
        if (!user || user.role !== 'RECEPTIONIST') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const { bill_id, payment_method } = await req.json();
        if (!bill_id || !payment_method) {
            return NextResponse.json({ message: 'Bill ID and payment method required' }, { status: 400 });
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // 1. Mark bill as PAID
            await connection.execute(
                `UPDATE bills SET status = 'PAID', paid_at = NOW(), payment_method = ?, paid_by = ? WHERE id = ? AND status = 'PENDING'`,
                [payment_method, user.id, bill_id]
            );

            // 2. Get appointment and mark COMPLETED
            const [billRows]: any = await connection.execute(
                'SELECT appointment_id FROM bills WHERE id = ?',
                [bill_id]
            );
            if (billRows.length > 0) {
                await connection.execute(
                    "UPDATE appointments SET status = 'COMPLETED' WHERE id = ? AND status != 'CANCELLED'",
                    [billRows[0].appointment_id]
                );
            }

            await connection.commit();
            return NextResponse.json({ message: 'Payment marked as paid successfully' });

        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Payment Error:', error);
        return NextResponse.json({ message: 'Failed to process payment' }, { status: 500 });
    }
}
