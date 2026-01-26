
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';
import bcrypt from 'bcryptjs';

// Define Interface for validation (could be Zod in future)
interface PatientRegistration {
    name: string;
    email: string;
    phone: string;
    date_of_birth: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    address: string;
    medical_history?: string;
    password?: string; // Optional, can generate default
}

export async function POST(req: Request) {
    try {
        // Auth Check
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        const user = await AuthService.verifyToken(token || '');
        if (!user || user.role !== 'RECEPTIONIST') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const body: PatientRegistration = await req.json();

        // 1. Validation
        if (!body.name || !body.email || !body.date_of_birth || !body.gender || !body.address) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // 2. Create User Account
            // Default password logic if not provided (e.g., phone number or 'welcome123')
            // Ideally, email them a reset link, but for now we set a temp password.
            const tempPassword = body.phone || 'welcome123';
            const passwordHash = await bcrypt.hash(tempPassword, 10);

            const [userResult]: any = await connection.execute(
                `INSERT INTO users (email, password_hash, name, role, phone) VALUES (?, ?, ?, 'PATIENT', ?)`,
                [body.email, passwordHash, body.name, body.phone]
            );
            const userId = userResult.insertId;

            // 3. Create Patient Record
            await connection.execute(
                `INSERT INTO patients (user_id, date_of_birth, gender, address, medical_history) VALUES (?, ?, ?, ?, ?)`,
                [userId, body.date_of_birth, body.gender, body.address, body.medical_history || '']
            );

            await connection.commit();
            return NextResponse.json({ message: 'Patient Registered Successfully', userId });

        } catch (err: any) {
            await connection.rollback();
            if (err.code === 'ER_DUP_ENTRY') {
                return NextResponse.json({ message: 'Email already exists' }, { status: 409 });
            }
            throw err;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Register Patient Error:', error);
        return NextResponse.json({ message: 'Internal Error' }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        // Auth Check
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        const user = await AuthService.verifyToken(token || '');
        if (!user || user.role !== 'RECEPTIONIST') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const query = searchParams.get('q') || '';

        let sql = `
            SELECT u.id, u.name, u.email, u.phone, p.date_of_birth, p.gender 
            FROM users u
            JOIN patients p ON u.id = p.user_id
            WHERE u.role = 'PATIENT'
        `;

        const params: any[] = [];
        if (query) {
            sql += ` AND (u.name LIKE ? OR u.phone LIKE ? OR u.email LIKE ?)`;
            params.push(`%${query}%`, `%${query}%`, `%${query}%`);
        }

        sql += ` ORDER BY u.created_at DESC LIMIT 50`;

        const [patients] = await pool.query(sql, params);
        return NextResponse.json(patients);

    } catch (error) {
        console.error('Search Patient Error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
