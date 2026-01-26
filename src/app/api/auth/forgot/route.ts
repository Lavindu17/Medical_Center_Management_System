import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { z } from 'zod';

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

        await AuthService.initiatePasswordReset(email);

        return NextResponse.json({ message: 'If the email exists, a reset code has been sent.' }, { status: 200 });

    } catch (error) {
        console.error('Forgot Password Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
