
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

        // 1. Fetch Prescription Details
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

        // 2. Fetch Items
        const items: any = await query(
            `SELECT 
                pi.id as item_id, 
                pi.medicine_id, 
                pi.quantity as prescribed_quantity, 
                pi.dispensed_quantity,
                pi.rejection_reason,
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

        // 3. Attach FEFO-ordered batches per item (all with stock > 0, including expired for display)
        for (const item of items) {
            const batches: any = await query(
                `SELECT 
                    id as batch_id,
                    batch_number,
                    expiry_date,
                    quantity_current,
                    selling_price,
                    DATEDIFF(expiry_date, CURDATE()) as days_until_expiry
                 FROM inventory_batches
                 WHERE medicine_id = ? AND quantity_current > 0
                 ORDER BY expiry_date ASC`,
                [item.medicine_id]
            );
            item.batches = batches;
        }

        return NextResponse.json({ prescription, items });

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
        const { action = 'DISPENSE', medicine_id, quantity_to_dispense, item_id, reason } = body;

        if (!item_id) {
            return NextResponse.json({ error: 'item_id is required' }, { status: 400 });
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // ─── REJECT ──────────────────────────────────
            if (action === 'REJECT') {
                if (!reason || !['OUT_OF_STOCK', 'PATIENT_REJECTED'].includes(reason)) {
                    throw new Error('Invalid rejection reason.');
                }

                await connection.execute(
                    'UPDATE prescription_items SET status = ?, rejection_reason = ? WHERE id = ?',
                    ['REJECTED', reason, item_id]
                );

                const [allItems]: any = await connection.execute(
                    'SELECT status FROM prescription_items WHERE prescription_id = ?',
                    [id]
                );
                const allDone = allItems.every((i: any) => i.status === 'DISPENSED' || i.status === 'REJECTED');
                const anyDispensed = allItems.some((i: any) => i.status === 'DISPENSED');
                const presStatus = allDone ? (anyDispensed ? 'COMPLETED' : 'PARTIALLY_COMPLETED') : 'PARTIALLY_COMPLETED';

                await connection.execute('UPDATE prescriptions SET status = ? WHERE id = ?', [presStatus, id]);
                await connection.commit();
                return NextResponse.json({ message: 'Item rejected', prescription_status: presStatus });
            }

            // ─── DISPENSE ─────────────────────────────────
            if (!medicine_id || !quantity_to_dispense) {
                throw new Error('medicine_id and quantity_to_dispense are required');
            }

            let pharmacyCost = 0;
            let quantityNeeded = parseInt(quantity_to_dispense);

            const [itemRows]: any = await connection.execute(
                'SELECT status, quantity, dispensed_quantity FROM prescription_items WHERE id = ?',
                [item_id]
            );
            if (itemRows.length === 0) throw new Error('Item not found');
            const itemDb = itemRows[0];
            if (itemDb.status === 'DISPENSED') throw new Error('Item already fully dispensed');
            if (itemDb.status === 'REJECTED') throw new Error('Item has been rejected');

            const remainder = itemDb.quantity - itemDb.dispensed_quantity;
            if (quantityNeeded > remainder) {
                throw new Error(`Cannot dispense more than prescribed. Remainder is ${remainder}.`);
            }

            // FEFO — skip expired batches
            const [batches]: any = await connection.execute(
                `SELECT id, quantity_current, selling_price,
                        DATEDIFF(expiry_date, CURDATE()) as days_until_expiry
                 FROM inventory_batches 
                 WHERE medicine_id = ? AND quantity_current > 0
                 ORDER BY expiry_date ASC`,
                [medicine_id]
            );

            for (const batch of batches) {
                if (quantityNeeded <= 0) break;
                if (batch.days_until_expiry < 0) continue; // skip expired

                const take = Math.min(quantityNeeded, batch.quantity_current);

                await connection.execute(
                    `UPDATE inventory_batches 
                     SET quantity_current = quantity_current - ?, 
                         status = CASE WHEN quantity_current - ? = 0 THEN 'DEPLETED' ELSE status END
                     WHERE id = ?`,
                    [take, take, batch.id]
                );
                await connection.execute('UPDATE medicines SET stock = stock - ? WHERE id = ?', [take, medicine_id]);

                pharmacyCost += Number(batch.selling_price) * take;
                quantityNeeded -= take;
            }

            if (quantityNeeded > 0) {
                throw new Error(`Insufficient non-expired stock. Need ${quantityNeeded} more units.`);
            }

            // Mark item
            const newDispensedTotal = itemDb.dispensed_quantity + parseInt(quantity_to_dispense);
            const newItemStatus = newDispensedTotal >= itemDb.quantity ? 'DISPENSED' : 'PARTIALLY_COMPLETED';
            await connection.execute(
                'UPDATE prescription_items SET status = ?, dispensed_quantity = ? WHERE id = ?',
                [newItemStatus, newDispensedTotal, item_id]
            );

            // Update bill
            const [rows]: any = await connection.execute('SELECT appointment_id FROM prescriptions WHERE id = ?', [id]);
            const appointmentId = rows[0]?.appointment_id;
            if (appointmentId) {
                const [bills]: any = await connection.execute('SELECT id, pharmacy_total FROM bills WHERE appointment_id = ?', [appointmentId]);
                if (bills.length > 0) {
                    await connection.execute(
                        `UPDATE bills SET pharmacy_total = pharmacy_total + ?, total_amount = total_amount + ? WHERE id = ?`,
                        [pharmacyCost, pharmacyCost, bills[0].id]
                    );
                }
            }

            // Re-evaluate prescription status
            const [allItems]: any = await connection.execute(
                'SELECT status FROM prescription_items WHERE prescription_id = ?',
                [id]
            );
            const allDone = allItems.every((i: any) => i.status === 'DISPENSED' || i.status === 'REJECTED');
            const anyDispensed = allItems.some((i: any) => i.status === 'DISPENSED');
            const presStatus = allDone ? (anyDispensed ? 'COMPLETED' : 'PARTIALLY_COMPLETED') : 'PARTIALLY_COMPLETED';

            await connection.execute('UPDATE prescriptions SET status = ? WHERE id = ?', [presStatus, id]);
            await connection.commit();

            return NextResponse.json({
                message: 'Item dispensed successfully',
                fully_dispensed: allDone,
                prescription_status: presStatus
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
