import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { limiterKey, rateLimited } from '@/lib/rate-limit';
import { z } from 'zod';

const resetSchema = z.object({
    email: z.string().email(),
    code: z.string().trim().min(1).max(32),
    // bcrypt only uses the first 72 bytes, so longer passwords would silently be truncated
    newPassword: z.string().min(6).refine((p) => Buffer.byteLength(p) <= 72, 'Password is too long (72 bytes maximum)'),
});

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);

        const validation = resetSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten() }, { status: 400 });
        }

        const { email, code, newPassword } = validation.data;

        if (await rateLimited(limiterKey('reset', email), 30, 60 * 60)) {
            return NextResponse.json({ message: 'Too many attempts. Please try again later.' }, { status: 429 });
        }

        const result = await AuthService.resetPassword(email, code, newPassword);

        if (!result.success) {
            return NextResponse.json({ message: result.message }, { status: 400 });
        }

        return NextResponse.json({ message: 'Password reset successfully' });

    } catch (error) {
        console.error('Reset Password Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
