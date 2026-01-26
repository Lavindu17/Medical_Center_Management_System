
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

// GET All Lab Tests
export async function GET(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        const user = await AuthService.verifyToken(token || '');
        if (!user || (user.role !== 'LAB_ASSISTANT' && user.role !== 'DOCTOR')) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const tests = await query('SELECT * FROM lab_tests ORDER BY name ASC');
        return NextResponse.json(tests);
    } catch (error) {
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}

// POST Create New Lab Test
export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        const user = await AuthService.verifyToken(token || '');
        if (!user || user.role !== 'LAB_ASSISTANT') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const { name, description, price } = await req.json();

        if (!name || !price) {
            return NextResponse.json({ message: 'Name and Price are required' }, { status: 400 });
        }

        await query(
            'INSERT INTO lab_tests (name, description, price) VALUES (?, ?, ?)',
            [name, description, price]
        );

        return NextResponse.json({ message: 'Lab Test Added Successfully' });
    } catch (error) {
        console.error('Create Test Error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
