import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { handleError } from '@/lib/errors';
import { z } from 'zod';
import { cookies } from 'next/headers';

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // 1. Validation
        const validation = loginSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten() }, { status: 400 });
        }

        const { email, password } = validation.data;

        // 2. Fetch User
        const user = await AuthService.getUserByEmailWithPassword(email);

        if (!user) {
            return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
        }

        // Check verification status
        if (!user.is_verified) {
            return NextResponse.json({ message: 'Email not verified. Please verify your email to log in.' }, { status: 403 });
        }

        // 3. Verify Password
        const isValid = await AuthService.comparePassword(password, user.password_hash);
        if (!isValid) {
            return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
        }

        // 4. Generate Token (JWT)
        const token = await AuthService.generateToken(user);

        // 5. Set Cookie
        (await cookies()).set({
            name: 'token',
            value: token,
            httpOnly: true,
            path: '/',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24, // 1 day
        });

        // 6. Return standard user object (without password)
        const { password_hash, ...userWithoutPassword } = user;

        return NextResponse.json({
            message: 'Login successful',
            user: userWithoutPassword,
            token // Return token in body too for flexibility
        });

    } catch (error: any) {
        console.error('Login Error:', error);
        return handleError(error);
    }
}
