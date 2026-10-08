import { requireRole } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    const auth = await requireRole('ADMIN', 'DOCTOR');
    if ('error' in auth) return auth.error;

    try {
        const tests = await query('SELECT id, name, price FROM lab_tests ORDER BY name ASC');
        return NextResponse.json(tests);
    } catch (error) {
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
