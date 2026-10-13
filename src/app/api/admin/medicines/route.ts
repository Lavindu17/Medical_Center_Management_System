import { requireRole } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    const auth = await requireRole('ADMIN', 'DOCTOR');
    if ('error' in auth) return auth.error;

    try {
        // usable_stock leaves out batches that have expired, so the doctor sees what can really be dispensed
        const medicines = await query(
            `SELECT m.id, m.name, m.generic_name, m.strength, m.stock, m.unit, m.dosage_form, m.price_per_unit AS price,
                    COALESCE((SELECT SUM(b.quantity_current) FROM inventory_batches b WHERE b.medicine_id = m.id AND b.expiry_date >= CURDATE()), 0) AS usable_stock
             FROM medicines m ORDER BY m.name ASC`);
        return NextResponse.json(medicines);
    } catch (error) {
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
