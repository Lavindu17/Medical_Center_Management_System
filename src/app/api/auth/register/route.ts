import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { query, pool } from '@/lib/db';
import { handleError } from '@/lib/errors';
import { User } from '@/types';
import { z } from 'zod';
import crypto from 'crypto';
import { EmailService } from '@/services/email.service';

const registerSchema = z.object({
    firstName: z.string().min(2),
    lastName: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    dob: z.string(), // YYYY-MM-DD
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
    address: z.string().optional(),
});

export async function POST(req: Request) {
    try {
        const body = await req.json();

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

        // 3. Generate OTP
        const verificationCode = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars hex
        const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

        // 4. Create User & Patient Profile (Transaction)
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const hashedPassword = await AuthService.hashPassword(password);

            // Insert into users
            const [userResult]: any = await connection.execute(
                'INSERT INTO users (email, password_hash, name, role, is_verified, verification_code, verification_expires) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [email, hashedPassword, name, 'PATIENT', false, verificationCode, verificationExpires]
            );

            const userId = userResult.insertId;

            // Insert into patients
            await connection.execute(
                'INSERT INTO patients (user_id, date_of_birth, gender, address) VALUES (?, ?, ?, ?)',
                [userId, dob, gender, address || '']
            );

            await connection.commit();

            // 5. Send Verification Email (Non-blocking usually, but await here for certainty)
            await EmailService.sendVerificationEmail(email, verificationCode);

            return NextResponse.json({ message: 'Account created. Please check your email for the verification code.' }, { status: 201 });

        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

    } catch (error: any) {
        console.error('Registration Error:', error);
        return handleError(error);
    }
}
