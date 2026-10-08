import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { limiterKey, rateLimited } from '@/lib/rate-limit';
import { z } from 'zod';

const forgotSchema = z.object({
    email: z.string().email(),
});

const GENERIC = { message: 'If the email exists, a reset code has been sent.' };

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);

        const validation = forgotSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid email' }, { status: 400 });
        }

        const { email } = validation.data;

        // Applies to every address (existing or not) so it cannot be used to probe accounts or to flood one inbox
        if (await rateLimited(limiterKey('forgot', email), 3, 60 * 60)) {
            return NextResponse.json({ message: 'Too many requests. Please try again later.' }, { status: 429 });
        }

        try {
            await AuthService.initiatePasswordReset(email);
        } catch (err) {
            // A mail outage must not reveal (through a 500) that the address belongs to an account
            console.error('Forgot Password: could not issue/send code:', err);
        }

        return NextResponse.json(GENERIC, { status: 200 });

    } catch (error) {
        console.error('Forgot Password Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
