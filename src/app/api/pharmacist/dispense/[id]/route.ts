
import { NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';
import { AuthService } from '@/services/auth.service';
import { cookies } from 'next/headers';

async function getPharmacist() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;
    const user = await AuthService.verifyToken(token);
    // @ts-ignore
    if (!user || user.role !== 'PHARMACIST') return null;
    return user;
}

export async function GET(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const user = await getPharmacist();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = params;

        // 1. Fetch Prescription Details (Patient, Doctor, Date)
        const presRows: any = await query(
            `SELECT 
                p.id, p.status, p.issued_at as created_at, p.appointment_id,
                pat_user.name as patient_name, pat_user.id as patient_id, 
                pat_details.gender, pat_details.date_of_birth,
                (SELECT GROUP_CONCAT(CONCAT(allergy_name, ' (', severity, ')') SEPARATOR ', ') FROM patient_allergies WHERE patient_id = pat_user.id) as allergies,
                doc_user.name as doctor_name
             FROM prescriptions p
             JOIN appointments a ON p.appointment_id = a.id
             JOIN users pat_user ON a.patient_id = pat_user.id
             LEFT JOIN patients pat_details ON a.patient_id = pat_details.user_id
             JOIN users doc_user ON p.doctor_id = doc_user.id
             WHERE p.id = ?`,
            [id]
        );

        if (presRows.length === 0) {
            return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
        }

        const prescription = presRows[0];

        // 2. Fetch Items with Current Stock info
        // We join with medicines table to get stock, price, name.
        const items = await query(
            `SELECT 
                pi.id as item_id, 
                pi.medicine_id, 
                pi.quantity as prescribed_quantity, 
                pi.dosage, pi.frequency, pi.duration,
                m.name as medicine_name, 
                m.generic_name,
                m.manufacturer,
                m.location,
                m.category,
                m.stock as current_stock, 
                m.price_per_unit as selling_price, 
                m.unit,
                pi.status
             FROM prescription_items pi
             LEFT JOIN medicines m ON pi.medicine_id = m.id
             WHERE pi.prescription_id = ?`,
            [id]
        );

        return NextResponse.json({
            prescription,
            items
        });

    } catch (error) {
        console.error('Error fetching dispense details:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const user = await getPharmacist();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = params;
        const body = await request.json();

        // Supports both single item and bulk (though UI will use single)
        // Expected body: { medicine_id, quantity_to_dispense, item_id }
        const { medicine_id, quantity_to_dispense, item_id } = body;

        if (!medicine_id || !quantity_to_dispense || !item_id) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            let pharmacyCost = 0;
            let quantityNeeded = parseInt(quantity_to_dispense);

            // 1. Check if item is already dispensed
            const [itemRows]: any = await connection.execute(
                'SELECT status FROM prescription_items WHERE id = ?',
                [item_id]
            );

            if (itemRows.length === 0) throw new Error('Item not found');
            if (itemRows[0].status === 'DISPENSED') throw new Error('Item already dispensed');

            // 2. FEFO Stock Deduction
            const [batches]: any = await connection.execute(
                `SELECT id, quantity_current, selling_price 
                 FROM inventory_batches 
                 WHERE medicine_id = ? AND quantity_current > 0 AND status = 'ACTIVE'
                 ORDER BY expiry_date ASC`,
                [medicine_id]
            );

            for (const batch of batches) {
                if (quantityNeeded <= 0) break;

                const take = Math.min(quantityNeeded, batch.quantity_current);

                await connection.execute(
                    `UPDATE inventory_batches 
                     SET quantity_current = quantity_current - ?, 
                         status = CASE WHEN quantity_current - ? = 0 THEN 'DEPLETED' ELSE status END
                     WHERE id = ?`,
                    [take, take, batch.id]
                );

                await connection.execute(
                    'UPDATE medicines SET stock = stock - ? WHERE id = ?',
                    [take, medicine_id]
                );

                const cost = Number(batch.selling_price) * take;
                pharmacyCost += cost;
                quantityNeeded -= take;
            }

            if (quantityNeeded > 0) {
                throw new Error(`Insufficient stock. Need ${quantityNeeded} more.`);
            }

            // 3. Mark Item as Dispensed
            await connection.execute(
                'UPDATE prescription_items SET status = "DISPENSED" WHERE id = ?',
                [item_id]
            );

            // 4. Update Bill
            const [rows]: any = await connection.execute('SELECT appointment_id FROM prescriptions WHERE id = ?', [id]);
            const appointmentId = rows[0]?.appointment_id;

            if (appointmentId) {
                const [bills]: any = await connection.execute('SELECT id, pharmacy_total FROM bills WHERE appointment_id = ?', [appointmentId]);
                if (bills.length > 0) {
                    const billId = bills[0].id;
                    const newTotal = Number(bills[0].pharmacy_total) + pharmacyCost;

                    await connection.execute(
                        `UPDATE bills 
                         SET pharmacy_total = ?, total_amount = total_amount + ? 
                         WHERE id = ?`,
                        [newTotal, pharmacyCost, billId]
                    );
                }
            }

            // 5. Check if Prescription is Fully Dispensed
            const [pendingItems]: any = await connection.execute(
                'SELECT COUNT(*) as count FROM prescription_items WHERE prescription_id = ? AND status = "PENDING"',
                [id]
            );

            let isFullyDispensed = false;
            if (pendingItems[0].count === 0) {
                await connection.execute(
                    'UPDATE prescriptions SET status = "DISPENSED" WHERE id = ?',
                    [id]
                );
                isFullyDispensed = true;
            }

            await connection.commit();
            return NextResponse.json({
                message: 'Item dispensed successfully',
                fully_dispensed: isFullyDispensed
            });

        } catch (err: any) {
            await connection.rollback();
            console.error(err);
            return NextResponse.json({ error: err.message }, { status: 500 });
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Dispense Error:', error);
        return NextResponse.json({ error: 'Failed to process' }, { status: 500 });
    }
}
