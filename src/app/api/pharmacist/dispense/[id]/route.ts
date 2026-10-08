
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { query, pool } from '@/lib/db';
import { AuthService } from '@/services/auth.service';
import { cookies } from 'next/headers';
import { prescriptionStatus } from '@/lib/prescription';
import { notify, usersWithRole } from '@/lib/notify';

export async function GET(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const auth = await requireRole('PHARMACIST');
        if ('error' in auth) return auth.error;
        const user = auth.user;

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
            return NextResponse.json({ message: 'Prescription not found' }, { status: 404 });
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
        return NextResponse.json({ message: 'Failed' }, { status: 500 });
    }
}

/** Business-rule failure that maps to a specific HTTP status instead of a generic 500. */
class HttpError extends Error {
    constructor(public status: number, message: string) { super(message); }
}

export async function POST(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const auth = await requireRole('PHARMACIST');
        if ('error' in auth) return auth.error;
        const user = auth.user;

        const prescriptionId = Number(params.id);
        const body = await request.json().catch(() => ({}));
        const { action = 'DISPENSE', quantity_to_dispense, reason } = body;
        const itemId = Number(body.item_id);

        if (!Number.isInteger(prescriptionId) || prescriptionId <= 0) {
            return NextResponse.json({ message: 'Invalid prescription id' }, { status: 400 });
        }
        if (!Number.isInteger(itemId) || itemId <= 0) {
            return NextResponse.json({ message: 'item_id is required' }, { status: 400 });
        }
        if (!['DISPENSE', 'REJECT'].includes(action)) {
            return NextResponse.json({ message: 'Unknown action' }, { status: 400 });
        }
        let quantityNeeded = 0;
        if (action === 'DISPENSE') {
            quantityNeeded = Number(quantity_to_dispense);
            if (!Number.isInteger(quantityNeeded) || quantityNeeded <= 0) {
                return NextResponse.json({ message: 'quantity_to_dispense must be a positive whole number' }, { status: 400 });
            }
        } else if (!['OUT_OF_STOCK', 'PATIENT_REJECTED'].includes(reason)) {
            return NextResponse.json({ message: 'Invalid rejection reason.' }, { status: 400 });
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Lock order: prescription -> item -> batches (FEFO order). Taking the same locks in the same order
            // serialises double-clicks and competing pharmacists without deadlocking.
            const [presRows]: any = await connection.execute(
                'SELECT id, appointment_id, status FROM prescriptions WHERE id = ? FOR UPDATE', [prescriptionId]);
            if (presRows.length === 0) throw new HttpError(404, 'Prescription not found');

            const [itemRows]: any = await connection.execute(
                'SELECT id, medicine_id, status, quantity, dispensed_quantity FROM prescription_items WHERE id = ? AND prescription_id = ? FOR UPDATE',
                [itemId, prescriptionId]);
            if (itemRows.length === 0) throw new HttpError(404, 'Item not found on this prescription');
            const item = itemRows[0];
            if (item.status === 'DISPENSED') throw new HttpError(409, 'Item already fully dispensed');
            if (item.status === 'REJECTED') throw new HttpError(409, 'Item has been rejected');

            let lowStock: { name: string; stock: number } | null = null;

            if (action === 'REJECT') {
                await connection.execute(
                    'UPDATE prescription_items SET status = ?, rejection_reason = ? WHERE id = ?',
                    ['REJECTED', reason, itemId]);
            } else {
                if (body.medicine_id !== undefined && Number(body.medicine_id) !== item.medicine_id) {
                    throw new HttpError(400, 'medicine_id does not match the prescribed item');
                }
                const remainder = item.quantity - item.dispensed_quantity;
                if (quantityNeeded > remainder) {
                    throw new HttpError(409, `Cannot dispense more than prescribed. Remainder is ${remainder}.`);
                }

                // FEFO: earliest-expiring non-expired batch first
                const [batches]: any = await connection.execute(
                    `SELECT id, quantity_current, selling_price,
                            DATEDIFF(expiry_date, CURDATE()) AS days_until_expiry
                     FROM inventory_batches
                     WHERE medicine_id = ? AND quantity_current > 0
                     ORDER BY expiry_date ASC, id ASC
                     FOR UPDATE`,
                    [item.medicine_id]);

                let cost = 0;
                let left = quantityNeeded;
                for (const batch of batches) {
                    if (left <= 0) break;
                    if (batch.days_until_expiry < 0) continue; // never dispense expired stock

                    const take = Math.min(left, batch.quantity_current);
                    const remaining = batch.quantity_current - take;
                    await connection.execute(
                        'UPDATE inventory_batches SET quantity_current = ?, status = ? WHERE id = ?',
                        [remaining, remaining === 0 ? 'DEPLETED' : 'ACTIVE', batch.id]);
                    await connection.execute('UPDATE medicines SET stock = stock - ? WHERE id = ?', [take, item.medicine_id]);

                    cost += Number(batch.selling_price) * take;
                    left -= take;
                }
                if (left > 0) {
                    throw new HttpError(409, `Insufficient non-expired stock. Need ${left} more units.`);
                }

                // Did this dispense take the medicine down to (or below) its reorder level?
                const [[med]]: any = await connection.execute('SELECT name, stock, min_stock_level FROM medicines WHERE id = ?', [item.medicine_id]);
                if (med && med.min_stock_level !== null && med.stock <= med.min_stock_level && med.stock + quantityNeeded > med.min_stock_level) {
                    lowStock = { name: med.name, stock: med.stock };
                }

                const dispensedTotal = item.dispensed_quantity + quantityNeeded;
                await connection.execute(
                    'UPDATE prescription_items SET status = ?, dispensed_quantity = ?, dispensed_amount = dispensed_amount + ? WHERE id = ?',
                    [dispensedTotal >= item.quantity ? 'DISPENSED' : 'PARTIALLY_COMPLETED', dispensedTotal, cost, itemId]);
            }

            // The pharmacy line of the bill is always derived from what was actually dispensed.
            // A bill that is already PAID is a closed financial record and is never rewritten.
            const [bills]: any = await connection.execute(
                'SELECT id, status FROM bills WHERE appointment_id = ? FOR UPDATE', [presRows[0].appointment_id]);
            if (bills.length > 0 && bills[0].status !== 'PAID') {
                await connection.execute(
                    `UPDATE bills b SET
                        b.pharmacy_total = (SELECT COALESCE(SUM(pi.dispensed_amount), 0) FROM prescription_items pi
                                            JOIN prescriptions p ON p.id = pi.prescription_id WHERE p.appointment_id = b.appointment_id),
                        b.total_amount = b.doctor_fee + b.service_charge + b.lab_total + (SELECT COALESCE(SUM(pi.dispensed_amount), 0) FROM prescription_items pi
                                            JOIN prescriptions p ON p.id = pi.prescription_id WHERE p.appointment_id = b.appointment_id)
                     WHERE b.id = ?`,
                    [bills[0].id]);
            }

            const [allItems]: any = await connection.execute(
                'SELECT status FROM prescription_items WHERE prescription_id = ?', [prescriptionId]);
            const presStatus = prescriptionStatus(allItems);
            const previousStatus = presRows[0].status;
            await connection.execute('UPDATE prescriptions SET status = ? WHERE id = ?', [presStatus, prescriptionId]);

            const [[owner]]: any = await connection.execute('SELECT patient_id FROM appointments WHERE id = ?', [presRows[0].appointment_id]);
            if (owner) {
                if (action === 'REJECT') {
                    await notify(connection, owner.patient_id, {
                        type: 'MEDICINE_UNAVAILABLE', title: 'A medicine could not be supplied',
                        body: 'The pharmacy could not supply one of your prescribed medicines. Please speak to the pharmacist.', link: '/patient/prescriptions',
                    });
                } else if (presStatus === 'COMPLETED' && previousStatus !== 'COMPLETED') {
                    await notify(connection, owner.patient_id, {
                        type: 'PRESCRIPTION_DISPENSED', title: 'Your medicines are ready',
                        body: 'Your prescription has been dispensed.', link: '/patient/prescriptions',
                    });
                }
            }
            if (lowStock) {
                await notify(connection, await usersWithRole(connection, 'PHARMACIST'), {
                    type: 'LOW_STOCK', title: 'Low stock',
                    body: `${lowStock.name} is down to ${lowStock.stock} units.`, link: '/pharmacist/alerts',
                });
            }
            await connection.commit();

            return NextResponse.json({
                message: action === 'REJECT' ? 'Item rejected' : 'Item dispensed successfully',
                fully_dispensed: presStatus === 'COMPLETED',
                prescription_status: presStatus
            });
        } catch (err: any) {
            await connection.rollback().catch(() => {});
            if (err instanceof HttpError) {
                return NextResponse.json({ message: err.message }, { status: err.status });
            }
            console.error('Dispense Error:', err);
            return NextResponse.json({ message: 'Failed to process' }, { status: 500 });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Dispense Error:', error);
        return NextResponse.json({ message: 'Failed to process' }, { status: 500 });
    }
}
