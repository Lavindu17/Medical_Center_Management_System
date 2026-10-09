import { NextResponse } from 'next/server';
import { audit, changedFields } from '@/lib/audit';
import { z } from 'zod';
import { query, pool } from '@/lib/db';
import { requireRole } from '@/lib/api-auth';
import { positiveId } from '@/lib/medicine-schema';

// GET endpoint to fetch batches for a specific medicine
export async function GET(req: Request) {
    const auth = await requireRole('PHARMACIST');
    if ('error' in auth) return auth.error;

    try {
        const medicineId = positiveId.safeParse(new URL(req.url).searchParams.get('medicineId'));
        if (!medicineId.success) {
            return NextResponse.json({ message: 'A valid medicineId is required' }, { status: 400 });
        }

        const batches = await query(`
            SELECT
                id,
                batch_number,
                expiry_date,
                quantity_initial,
                quantity_current,
                buying_price,
                selling_price,
                status,
                received_at,
                DATEDIFF(expiry_date, CURDATE()) as days_until_expiry
            FROM inventory_batches
            WHERE medicine_id = ?
            ORDER BY expiry_date ASC, id ASC
        `, [medicineId.data]);

        return NextResponse.json(batches);

    } catch (error) {
        console.error('Fetch Batches Error:', error);
        return NextResponse.json({ message: 'Error fetching batches' }, { status: 500 });
    }
}

const money = z.preprocess((v) => (v === '' || v === undefined || v === null ? undefined : v), z.coerce.number().min(0).max(1_000_000).optional());

const batchSchema = z.object({
    medicine_id: positiveId,
    batch_number: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().min(1).max(100).optional()),
    quantity: z.coerce.number({ message: 'Quantity must be a number' }).int('Quantity must be a whole number').min(1, 'Quantity must be at least 1').max(10_000_000),
    buying_price: money,
    selling_price: money,
    expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be a valid date').refine(
        (d) => { const x = new Date(d + 'T00:00:00Z'); return !Number.isNaN(x.getTime()) && x.toISOString().startsWith(d); },
        'Expiry date must be a valid date'),
});

class StockError extends Error {
    constructor(public status: number, message: string) { super(message); }
}

export async function POST(req: Request) {
    const auth = await requireRole('PHARMACIST');
    if ('error' in auth) return auth.error;

    try {
        const parsed = batchSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ message: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
        }
        const b = parsed.data;

        // Compare calendar dates as text in the pharmacy's local day (parsing to Date mixes UTC and local time)
        if (b.expiry_date <= new Date().toLocaleDateString('en-CA')) {
            return NextResponse.json({ message: 'Expiry date must be in the future' }, { status: 400 });
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Lock the medicine so the stock counter and its batches change together
            const [meds]: any = await connection.execute('SELECT id, price_per_unit FROM medicines WHERE id = ? FOR UPDATE', [b.medicine_id]);
            if (meds.length === 0) throw new StockError(404, 'Medicine not found');

            const batchNumber = b.batch_number ?? `BATCH-${Date.now()}`;
            const [dup]: any = await connection.execute(
                'SELECT id FROM inventory_batches WHERE medicine_id = ? AND batch_number = ?', [b.medicine_id, batchNumber]);
            if (dup.length > 0) throw new StockError(409, 'This batch number already exists for the medicine');

            // A batch without a price would be dispensed for free, so default to the medicine's list price
            const sellingPrice = b.selling_price ?? Number(meds[0].price_per_unit);

            await connection.execute(
                `INSERT INTO inventory_batches
                (medicine_id, batch_number, expiry_date, quantity_initial, quantity_current, buying_price, selling_price, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
                [b.medicine_id, batchNumber, b.expiry_date, b.quantity, b.quantity, b.buying_price ?? 0, sellingPrice]
            );
            await connection.execute('UPDATE medicines SET stock = stock + ? WHERE id = ?', [b.quantity, b.medicine_id]);

            await connection.commit();
            await audit(auth.user, { action: 'CREATE', entity: 'BATCH', entityId: batchNumber, details: { medicineId: b.medicine_id, quantity: b.quantity, expiry: b.expiry_date } });
            return NextResponse.json({ message: 'Batch added successfully' }, { status: 201 });
        } catch (err) {
            await connection.rollback().catch(() => {});
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        if (error instanceof StockError) {
            return NextResponse.json({ message: error.message }, { status: error.status });
        }
        console.error('Add Batch Error:', error);
        return NextResponse.json({ message: 'Error adding batch' }, { status: 500 });
    }
}
