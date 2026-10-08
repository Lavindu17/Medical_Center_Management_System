
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody } from '@/lib/validate';
import { requireRole } from '@/lib/api-auth';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

// GET All Lab Tests
export async function GET(req: Request) {
    try {
        const auth = await requireRole('LAB_ASSISTANT', 'DOCTOR');
        if ('error' in auth) return auth.error;
        const user = auth.user;

        const tests = await query('SELECT * FROM lab_tests ORDER BY name ASC');
        return NextResponse.json(tests);
    } catch (error) {
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}

const labTestSchema = z.object({
    name: z.string().trim().min(2, 'Test name must be at least 2 characters').max(100, 'Test name is too long'),
    description: z.string().trim().max(500, 'Description is too long').optional().nullable(),
    price: z.coerce.number({ message: 'Price must be a number' }).positive('Selling price must be more than 0').max(1_000_000, 'Selling price is too high'),
    cost_price: z.coerce.number({ message: 'Cost price must be a number' }).min(0, 'Cost price cannot be negative').max(1_000_000, 'Cost price is too high'),
});

// POST Create New Lab Test
export async function POST(req: Request) {
    try {
        const auth = await requireRole('LAB_ASSISTANT', 'DOCTOR', 'ADMIN');
        if ('error' in auth) return auth.error;
        const user = auth.user;

        const body = await parseBody(req, labTestSchema);
        if ('error' in body) return body.error;
        const { name, description, price, cost_price } = body.data;

        await query(
            'INSERT INTO lab_tests (name, description, price, cost_price) VALUES (?, ?, ?, ?)',
            [name, description || '', price, cost_price]
        );

        return NextResponse.json({ message: 'Lab Test Added Successfully' });
    } catch (error) {
        console.error('Create Test Error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
