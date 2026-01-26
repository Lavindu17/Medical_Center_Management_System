import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
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
