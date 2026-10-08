import { requireRole } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    const auth = await requireRole('ADMIN', 'DOCTOR');
    if ('error' in auth) return auth.error;

    try {
        const medicines = await query('SELECT id, name, stock, unit, dosage_form, price_per_unit as price FROM medicines ORDER BY name ASC');
        return NextResponse.json(medicines);
    } catch (error) {
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
