import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { limiterKey, rateLimited } from '@/lib/rate-limit';
import { z } from 'zod';

const schema = z.object({ email: z.string().email() });

const GENERIC = { message: 'If the account exists and is not yet verified, a new code has been sent.' };

// POST: send a fresh verification code (answers identically whether or not the address has an account)
export async function POST(req: Request) {
    try {
        const parsed = schema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ message: 'Invalid email' }, { status: 400 });
        }
        const { email } = parsed.data;

        // At most 5 codes an hour per address, and never faster than one a minute
        if (await rateLimited(limiterKey('resend-hour', email), 5, 60 * 60) || await rateLimited(limiterKey('resend-minute', email), 1, 60)) {
            return NextResponse.json({ message: 'Please wait a moment before requesting another code.' }, { status: 429 });
        }

        const user: any = await AuthService.findUserByEmail(email);
        if (user && !user.is_verified) {
            try {
                await AuthService.initiateEmailVerification(user.id, email);
            } catch (err) {
                console.error('Resend verification failed:', err);
            }
        }

        return NextResponse.json(GENERIC);
    } catch (error) {
        console.error('Resend Verification Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
