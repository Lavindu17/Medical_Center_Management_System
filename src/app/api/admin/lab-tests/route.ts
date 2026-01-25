import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
        const tests = await query('SELECT id, name, price FROM lab_tests ORDER BY name ASC');
        return NextResponse.json(tests);
    } catch (error) {
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
