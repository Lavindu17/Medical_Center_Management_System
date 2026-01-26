import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { z } from 'zod';
import crypto from 'crypto';
import { EmailService } from '@/services/email.service';

const forgotSchema = z.object({
    email: z.string().email(),
});

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const validation = forgotSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid email' }, { status: 400 });
        }

        const { email } = validation.data;

        // Check DB
        const users = await query<any[]>('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            // Security: Don't reveal if user exists. Return 200 anyway.
            return NextResponse.json({ message: 'If the email exists, a reset code has been sent.' }, { status: 200 });
        }

        const user = users[0];

        // Generate OTP
        const resetCode = crypto.randomBytes(3).toString('hex').toUpperCase();
        const resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

        // Update User
        await query('UPDATE users SET reset_code = ?, reset_expires = ? WHERE id = ?', [resetCode, resetExpires, user.id]);

        // Send Email
        await EmailService.sendPasswordResetEmail(email, resetCode);

        return NextResponse.json({ message: 'If the email exists, a reset code has been sent.' }, { status: 200 });

    } catch (error) {
        console.error('Forgot Password Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
