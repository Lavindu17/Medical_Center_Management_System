import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireRole } from '@/lib/api-auth';
import { medicineSchema } from '@/lib/medicine-schema';

export async function GET() {
    const auth = await requireRole('PHARMACIST');
    if ('error' in auth) return auth.error;

    try {
        // Fetch medicines with their calculated earliest expiry date from active batches
        const medicines = await query<any[]>(`
            SELECT
                m.*,
                MIN(b.expiry_date) as earliest_expiry,
                SUM(CASE WHEN b.status = 'ACTIVE' THEN b.quantity_current ELSE 0 END) as batch_stock
            FROM medicines m
            LEFT JOIN inventory_batches b ON m.id = b.medicine_id AND b.status = 'ACTIVE' AND b.quantity_current > 0
            GROUP BY m.id
            ORDER BY m.name ASC
        `);

        // SUM() comes back from mysql2 as a string; clients compare it numerically
        return NextResponse.json(medicines.map(m => ({ ...m, batch_stock: Number(m.batch_stock) || 0 })));
    } catch (error) {
        console.error('Fetch Inventory Error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}

// Register a medicine (master data only). Stock is added later as batches.
export async function POST(req: Request) {
    const auth = await requireRole('PHARMACIST');
    if ('error' in auth) return auth.error;

    try {
        const parsed = medicineSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ message: parsed.error.issues[0]?.message || 'Invalid input', errors: parsed.error.flatten() }, { status: 400 });
        }
        const m = parsed.data;

        const duplicate = await query<any[]>(
            `SELECT id FROM medicines WHERE LOWER(name) = LOWER(?) AND COALESCE(strength, '') = COALESCE(?, '')`,
            [m.name, m.strength ?? null]);
        if (duplicate.length > 0) {
            return NextResponse.json({ message: 'A medicine with this name and strength already exists' }, { status: 409 });
        }

        // A far-future expiry is a placeholder; real expiry dates belong to batches
        const result: any = await query(
            `INSERT INTO medicines
            (name, generic_name, manufacturer, category, stock, min_stock_level, unit, dosage_form, strength, price_per_unit, buying_price, expiry_date, location)
            VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 0, '9999-12-31', ?)`,
            [m.name, m.generic_name ?? null, m.manufacturer ?? null, m.category ?? null, m.min_stock_level,
             m.unit, m.dosage_form ?? null, m.strength ?? null, m.price_per_unit, m.location ?? null]);

        return NextResponse.json({ message: 'Medicine registered successfully. Add stock via batches.', id: result.insertId }, { status: 201 });
    } catch (error) {
        console.error('Create Medicine Error:', error);
        return NextResponse.json({ message: 'Error creating medicine' }, { status: 500 });
    }
}
