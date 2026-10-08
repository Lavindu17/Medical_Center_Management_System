import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireRole } from '@/lib/api-auth';
import { medicineSchema, positiveId } from '@/lib/medicine-schema';

async function parseId(props: { params: Promise<{ id: string }> }) {
    const parsed = positiveId.safeParse((await props.params).id);
    return parsed.success ? parsed.data : null;
}

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
    const auth = await requireRole('PHARMACIST');
    if ('error' in auth) return auth.error;

    try {
        const id = await parseId(props);
        if (id === null) return NextResponse.json({ message: 'Invalid medicine id' }, { status: 400 });

        const result = await query<any[]>('SELECT * FROM medicines WHERE id = ?', [id]);
        if (result.length === 0) return NextResponse.json({ message: 'Medicine not found' }, { status: 404 });
        return NextResponse.json(result[0]);
    } catch (error) {
        console.error('Error fetching medicine:', error);
        return NextResponse.json({ message: 'Failed to fetch medicine' }, { status: 500 });
    }
}

// Edit master data only. Stock and expiry change through batches and dispensing, never through this form.
export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
    const auth = await requireRole('PHARMACIST');
    if ('error' in auth) return auth.error;

    try {
        const id = await parseId(props);
        if (id === null) return NextResponse.json({ message: 'Invalid medicine id' }, { status: 400 });

        const parsed = medicineSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ message: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
        }
        const m = parsed.data;

        const duplicate = await query<any[]>(
            `SELECT id FROM medicines WHERE LOWER(name) = LOWER(?) AND COALESCE(strength, '') = COALESCE(?, '') AND id <> ?`,
            [m.name, m.strength ?? null, id]);
        if (duplicate.length > 0) {
            return NextResponse.json({ message: 'A medicine with this name and strength already exists' }, { status: 409 });
        }

        const result: any = await query(
            `UPDATE medicines
             SET name = ?, generic_name = ?, manufacturer = ?, category = ?, dosage_form = ?, strength = ?,
                 price_per_unit = ?, min_stock_level = ?, unit = ?, location = ?
             WHERE id = ?`,
            [m.name, m.generic_name ?? null, m.manufacturer ?? null, m.category ?? null, m.dosage_form ?? null, m.strength ?? null,
             m.price_per_unit, m.min_stock_level, m.unit, m.location ?? null, id]);
        if (result.affectedRows === 0) return NextResponse.json({ message: 'Medicine not found' }, { status: 404 });

        return NextResponse.json({ message: 'Medicine updated successfully' });
    } catch (error) {
        console.error('Error updating medicine:', error);
        return NextResponse.json({ message: 'Failed to update medicine' }, { status: 500 });
    }
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
    const auth = await requireRole('PHARMACIST');
    if ('error' in auth) return auth.error;

    try {
        const id = await parseId(props);
        if (id === null) return NextResponse.json({ message: 'Invalid medicine id' }, { status: 400 });

        const found = await query<any[]>(
            `SELECT m.id, COALESCE(SUM(b.quantity_current), 0) AS on_hand
             FROM medicines m LEFT JOIN inventory_batches b ON b.medicine_id = m.id WHERE m.id = ? GROUP BY m.id`, [id]);
        if (found.length === 0) return NextResponse.json({ message: 'Medicine not found' }, { status: 404 });
        if (Number(found[0].on_hand) > 0) {
            return NextResponse.json({ message: 'This medicine still has stock. Dispense or write it off first.' }, { status: 409 });
        }

        await query('DELETE FROM medicines WHERE id = ?', [id]);
        return NextResponse.json({ message: 'Medicine deleted successfully' });
    } catch (error: any) {
        // Prescriptions keep a reference to the medicine for the patient's record
        if (error?.errno === 1451) {
            return NextResponse.json({ message: 'This medicine appears on prescriptions and cannot be deleted.' }, { status: 409 });
        }
        console.error('Error deleting medicine:', error);
        return NextResponse.json({ message: 'Failed to delete medicine' }, { status: 500 });
    }
}
