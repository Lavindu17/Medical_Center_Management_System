import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { AuthService } from '@/services/auth.service';
import { z } from 'zod';

const resetSchema = z.object({
    email: z.string().email(),
    code: z.string().min(1),
    newPassword: z.string().min(6),
});

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const validation = resetSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
        }

        const { email, code, newPassword } = validation.data;

        // Check DB
        const users = await query<any[]>('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
        }

        const user = users[0];

        // Validate OTP
        if (user.reset_code !== code) {
            return NextResponse.json({ message: 'Invalid reset code' }, { status: 400 });
        }

        if (new Date() > new Date(user.reset_expires)) {
            return NextResponse.json({ message: 'Reset code expired' }, { status: 400 });
        }

        // Hash new password
        const hashedPassword = await AuthService.hashPassword(newPassword);

        // Update User (Clear reset code, set new password)
        await query('UPDATE users SET password_hash = ?, reset_code = NULL, reset_expires = NULL WHERE id = ?', [hashedPassword, user.id]);

        return NextResponse.json({ message: 'Password reset successfully' });

    } catch (error) {
        console.error('Reset Password Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
