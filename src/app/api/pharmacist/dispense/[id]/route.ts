
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
    { params }: { params: { id: string } }
) {
    try {
        const user = await getPharmacist();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = params;

        // 1. Fetch Prescription Details (Patient, Doctor, Date)
        const [presRows]: any = await query(
            `SELECT 
                p.id, p.status, p.created_at, p.appointment_id,
                pat.name as patient_name, pat.id as patient_id, pat.gender, pat.date_of_birth,
                u.name as doctor_name
             FROM prescriptions p
             JOIN appointments a ON p.appointment_id = a.id
             JOIN patients pat ON a.patient_id = pat.id
             JOIN users u ON p.doctor_id = u.id
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
                m.stock as current_stock, 
                m.selling_price, 
                m.unit
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
    { params }: { params: { id: string } }
) {
    try {
        const user = await getPharmacist();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = params;
        const body = await request.json();
        const { items } = body; // Array of { medicine_id, quantity_to_dispense, price }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            let pharmacyTotal = 0;

            // 1. Process Updates with FEFO Logic
            for (const item of items) {
                let quantityNeeded = parseInt(item.quantity_to_dispense);
                const medicineId = item.medicine_id;

                // Fetch batches sorted by expiry (FEFO)
                // Lock rows for update? For now, we assume simple concurrency. 
                // In prod, use FOR UPDATE or optimistic locking.
                const [batches]: any = await connection.execute(
                    `SELECT id, quantity_current, selling_price 
                     FROM inventory_batches 
                     WHERE medicine_id = ? AND quantity_current > 0 AND status = 'ACTIVE'
                     ORDER BY expiry_date ASC`,
                    [medicineId]
                );

                for (const batch of batches) {
                    if (quantityNeeded <= 0) break;

                    const take = Math.min(quantityNeeded, batch.quantity_current);

                    // Deduct from batch
                    await connection.execute(
                        `UPDATE inventory_batches 
                         SET quantity_current = quantity_current - ?, 
                             status = CASE WHEN quantity_current - ? = 0 THEN 'DEPLETED' ELSE status END
                         WHERE id = ?`,
                        [take, take, batch.id]
                    );

                    // Update Master Stock (Aggregate) - Optional but good for consistency if we keep master stock column
                    await connection.execute(
                        'UPDATE medicines SET stock = stock - ? WHERE id = ?',
                        [take, medicineId]
                    );

                    // Calculate Cost (Batch specific price)
                    const cost = Number(batch.selling_price) * take;
                    pharmacyTotal += cost;

                    quantityNeeded -= take;
                }

                if (quantityNeeded > 0) {
                    throw new Error(`Insufficient stock for medicine ID ${medicineId}. Need ${quantityNeeded} more.`);
                }
            }

            // 2. Update Prescription Status
            await connection.execute(
                'UPDATE prescriptions SET status = "DISPENSED" WHERE id = ?',
                [id]
            );

            // 3. Update Bill
            const [rows]: any = await connection.execute('SELECT appointment_id FROM prescriptions WHERE id = ?', [id]);
            const appointmentId = rows[0]?.appointment_id;

            if (appointmentId) {
                const [bills]: any = await connection.execute('SELECT id, total_amount, pharmacy_total FROM bills WHERE appointment_id = ?', [appointmentId]);

                if (bills.length > 0) {
                    const billId = bills[0].id;
                    const newPharmacyTotal = Number(bills[0].pharmacy_total) + pharmacyTotal;

                    await connection.execute(
                        `UPDATE bills 
                         SET pharmacy_total = ?, total_amount = total_amount + ? 
                         WHERE id = ?`,
                        [newPharmacyTotal, pharmacyTotal, billId]
                    );
                }
            }

            await connection.commit();
            return NextResponse.json({ message: 'Dispensed successfully' });

        } catch (err: any) {
            await connection.rollback();
            console.error(err);
            return NextResponse.json({ error: err.message || 'Dispense execution failed' }, { status: 500 });
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Dispense Error:', error);
        return NextResponse.json({ error: 'Failed to process dispensing' }, { status: 500 });
    }
}
