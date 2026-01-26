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
