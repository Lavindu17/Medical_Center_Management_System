import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { limiterKey, rateLimited } from '@/lib/rate-limit';
import { z } from 'zod';

const verifySchema = z.object({
    email: z.string().email(),
    code: z.string().trim().min(1).max(32),
});

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);

        const validation = verifySchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
        }

        const { email, code } = validation.data;

        // Per-code attempt limits already stop guessing; this also stops churning through fresh codes
        if (await rateLimited(limiterKey('verify', email), 30, 60 * 60)) {
            return NextResponse.json({ message: 'Too many attempts. Please try again later.' }, { status: 429 });
        }

        const result = await AuthService.verifyEmail(email, code);

        if (!result.success) {
            return NextResponse.json({ message: result.message }, { status: 400 });
        }

        return NextResponse.json({ message: result.message }, { status: 200 });

    } catch (error) {
        console.error('Verify Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
