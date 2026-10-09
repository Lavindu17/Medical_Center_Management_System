import { NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { z } from 'zod';
import { pool } from '@/lib/db';
import { requireRole } from '@/lib/api-auth';
import { audit } from '@/lib/audit';
import { AuthService } from '@/services/auth.service';
import { escapeLike } from '@/lib/html';

const registerSchema = z.object({
    name: z.string().trim().min(2).max(255),
    email: z.string().trim().email().max(255),
    phone: z.string().trim().max(20).optional(),
    date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => {
        const date = new Date(d + 'T00:00:00Z');
        return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(d) && date <= new Date() && date.getUTCFullYear() >= 1900;
    }, 'Enter a valid date of birth'),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
    address: z.string().trim().min(1).max(500),
    medical_history: z.string().max(5000).optional(),
});

/** Readable one-time password (no look-alike characters). Never derived from the phone number. */
function temporaryPassword() {
    const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 10 }, () => alphabet[randomInt(alphabet.length)]).join('');
}

export async function POST(req: Request) {
    const auth = await requireRole('RECEPTIONIST', 'ADMIN');
    if ('error' in auth) return auth.error;

    try {
        const parsed = registerSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ message: 'Missing or invalid fields', errors: parsed.error.flatten() }, { status: 400 });
        }
        const body = parsed.data;

        // The walk-in is identified at the desk, so the account is created verified. The generated password is
        // shown to the receptionist once; the patient can replace it any time with "Forgot password".
        const password = temporaryPassword();
        const passwordHash = await AuthService.hashPassword(password);

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [userResult]: any = await connection.execute(
                `INSERT INTO users (email, password_hash, name, role, phone, is_verified) VALUES (?, ?, ?, 'PATIENT', ?, TRUE)`,
                [body.email, passwordHash, body.name, body.phone || null]
            );
            const userId = userResult.insertId;

            await connection.execute(
                `INSERT INTO patients (user_id, date_of_birth, gender, address, medical_history) VALUES (?, ?, ?, ?, ?)`,
                [userId, body.date_of_birth, body.gender, body.address, body.medical_history || '']
            );

            await connection.commit();
            await audit(auth.user, { action: 'CREATE', entity: 'USER', entityId: userId, patientId: userId, details: { kind: 'patient_registered_by_reception' } });
            return NextResponse.json({ message: 'Patient Registered Successfully', userId, temporaryPassword: password });
        } catch (err: any) {
            await connection.rollback().catch(() => {});
            if (err?.errno === 1062) {
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
    const auth = await requireRole('RECEPTIONIST', 'ADMIN');
    if ('error' in auth) return auth.error;

    try {
        const q = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 100);

        let sql = `
            SELECT u.id, u.name, u.email, u.phone, p.date_of_birth, p.gender
            FROM users u
            JOIN patients p ON u.id = p.user_id
            WHERE u.role = 'PATIENT'
        `;

        const params: any[] = [];
        if (q) {
            const like = `%${escapeLike(q)}%`;
            sql += ` AND (u.name LIKE ? OR u.phone LIKE ? OR u.email LIKE ?)`;
            params.push(like, like, like);
        }

        sql += ` ORDER BY u.created_at DESC LIMIT 50`;

        const [patients] = await pool.query(sql, params);
        await audit(auth.user, { action: 'SEARCH', entity: 'PATIENT_CHART', details: { term: Boolean(q), termLength: q.length, results: (patients as any[]).length } });
        return NextResponse.json(patients);
    } catch (error) {
        console.error('Search Patient Error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
