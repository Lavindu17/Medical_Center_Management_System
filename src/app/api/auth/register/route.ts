import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { pool } from '@/lib/db';
import { handleError } from '@/lib/errors';
import { z } from 'zod';

const registerSchema = z.object({
    firstName: z.string().trim().min(2).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().email().max(255),
    // bcrypt only uses the first 72 bytes, so longer passwords would silently be truncated
    password: z.string().min(6).refine((p) => Buffer.byteLength(p) <= 72, 'Password is too long (72 bytes maximum)'),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => {
        const date = new Date(d + 'T00:00:00Z');
        return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(d) && date <= new Date() && date.getUTCFullYear() >= 1900;
    }, 'Enter a valid date of birth'),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
    address: z.string().max(500).optional(),
});

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);

        // 1. Validation
        const validation = registerSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten() }, { status: 400 });
        }

        const { firstName, lastName, email, password, dob, gender, address } = validation.data;
        const name = `${firstName} ${lastName}`;

        // 2. Check if user exists
        const existingUser = await AuthService.findUserByEmail(email);
        if (existingUser) {
            return NextResponse.json({ message: 'User already exists' }, { status: 409 });
        }

        // 3. Create User & Patient Profile (Transaction)
        const connection = await pool.getConnection();
        let userId: number;
        try {
            await connection.beginTransaction();
            const hashedPassword = await AuthService.hashPassword(password);

            const [userResult]: any = await connection.execute(
                'INSERT INTO users (email, password_hash, name, role, is_verified) VALUES (?, ?, ?, ?, FALSE)',
                [email, hashedPassword, name, 'PATIENT']
            );
            userId = userResult.insertId;

            await connection.execute(
                'INSERT INTO patients (user_id, date_of_birth, gender, address) VALUES (?, ?, ?, ?)',
                [userId, dob, gender, address || '']
            );

            await connection.commit();
        } catch (err: any) {
            await connection.rollback().catch(() => {});
            // Two simultaneous sign-ups with one address: the loser gets the same answer as a normal duplicate
            if (err?.errno === 1062) {
                return NextResponse.json({ message: 'User already exists' }, { status: 409 });
            }
            throw err;
        } finally {
            connection.release();
        }

        // 4. Send the verification code. The account already exists, so a mail failure must not strand it:
        //    the person can request another code from the verify page.
        try {
            await AuthService.initiateEmailVerification(userId, email);
        } catch (err) {
            console.error('Registration: verification email failed:', err);
            return NextResponse.json({
                message: 'Account created, but the verification email could not be sent. Use "Resend code" on the verification page.',
                emailSent: false,
            }, { status: 201 });
        }

        return NextResponse.json({ message: 'Account created. Please check your email for the verification code.', emailSent: true }, { status: 201 });

    } catch (error: any) {
        console.error('Registration Error:', error);
        return handleError(error);
    }
}
