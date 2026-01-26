import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { z } from 'zod';

const verifySchema = z.object({
    email: z.string().email(),
    code: z.string().min(1),
});

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const validation = verifySchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
        }

        const { email, code } = validation.data;

        // Check DB
        const users = await query<any[]>('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            console.log('DEBUG: User not found for email:', email);
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }

        const user = users[0];
        console.log('DEBUG: User found.', {
            id: user.id,
            is_verified: user.is_verified,
            stored_code: user.verification_code,
            received_code: code,
            expires: user.verification_expires
        });

        if (user.is_verified) {
            return NextResponse.json({ message: 'Email already verified' }, { status: 200 });
        }

        // Validate OTP (Case insensitive for better UX)
        if (user.verification_code?.toUpperCase() !== code.toUpperCase()) {
            console.log('DEBUG: Code mismatch.');
            return NextResponse.json({ message: 'Invalid verification code' }, { status: 400 });
        }

        if (new Date() > new Date(user.verification_expires)) {
            console.log('DEBUG: Code expired.');
            return NextResponse.json({ message: 'Verification code expired' }, { status: 400 });
        }

        // Update User
        await query('UPDATE users SET is_verified = TRUE, verification_code = NULL, verification_expires = NULL WHERE id = ?', [user.id]);

        return NextResponse.json({ message: 'Email verified successfully' });

    } catch (error) {
        console.error('Verify Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
