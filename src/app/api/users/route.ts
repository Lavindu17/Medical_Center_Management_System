import { NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';
import { AuthService } from '@/services/auth.service';
import { z } from 'zod';

// Fetch all users
export async function GET(req: Request) {
    try {
        const users = await query<any[]>('SELECT id, name, email, role, phone, created_at FROM users ORDER BY created_at DESC');
        return NextResponse.json(users);
    } catch (error) {
        return NextResponse.json({ message: 'Failed to fetch users' }, { status: 500 });
    }
}

const createUserSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(['DOCTOR', 'PHARMACIST', 'LAB_ASSISTANT', 'RECEPTIONIST', 'ADMIN']),
    phone: z.string().optional(),
    // Doctor specific
    specialization: z.string().optional(),
    licenseNumber: z.string().optional(),
});

// Create new staff
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const validation = createUserSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten() }, { status: 400 });
        }

        const { name, email, password, role, phone, specialization, licenseNumber } = validation.data;

        // Check if user exists
        const existingUser = await AuthService.findUserByEmail(email);
        if (existingUser) {
            return NextResponse.json({ message: 'User already exists' }, { status: 409 });
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const hashedPassword = await AuthService.hashPassword(password);

            const [result]: any = await connection.execute(
                'INSERT INTO users (email, password_hash, name, role, phone) VALUES (?, ?, ?, ?, ?)',
                [email, hashedPassword, name, role, phone || null]
            );

            const userId = result.insertId;

            if (role === 'DOCTOR') {
                if (!specialization || !licenseNumber) {
                    throw new Error('Specialization and License Number are required for Doctors');
                }
                await connection.execute(
                    'INSERT INTO doctors (user_id, specialization, license_number) VALUES (?, ?, ?)',
                    [userId, specialization, licenseNumber]
                );
            }

            await connection.commit();
            return NextResponse.json({ message: 'User created successfully' }, { status: 201 });

        } catch (err: any) {
            await connection.rollback();
            return NextResponse.json({ message: err.message || 'Database error' }, { status: 500 });
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Create User Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
