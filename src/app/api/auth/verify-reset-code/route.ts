import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { z } from 'zod';

const verifyCodeSchema = z.object({
    email: z.string().email(),
    code: z.string().min(1),
});

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const validation = verifyCodeSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
        }

        const { email, code } = validation.data;

        const result = await AuthService.validateResetCode(email, code);

        if (!result.success) {
            return NextResponse.json({ message: result.message }, { status: 400 });
        }

        return NextResponse.json({ message: 'Code is valid' }, { status: 200 });

    } catch (error) {
        console.error('Verify Reset Code Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
