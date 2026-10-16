import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { limiterKey, rateLimited } from '@/lib/rate-limit';
import { passwordProblem } from '@/lib/password';
import { z } from 'zod';

const resetSchema = z.object({
    email: z.string().email(),
    code: z.string().trim().min(1).max(32),
    newPassword: z.string(),
});

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);

        const validation = resetSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten() }, { status: 400 });
        }

        const { email, code, newPassword } = validation.data;
        const weak = passwordProblem(newPassword, [email]);
        if (weak) return NextResponse.json({ message: weak }, { status: 400 });

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
