import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { handleError } from '@/lib/errors';
import { clearLimit, limiterKey, rateLimited } from '@/lib/rate-limit';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { audit } from '@/lib/audit';

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1).max(200),
});

const MAX_ATTEMPTS = 10;
const WINDOW_SECONDS = 15 * 60;

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);

        // 1. Validation
        const validation = loginSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten() }, { status: 400 });
        }

        const { email, password } = validation.data;

        // 2. Throttle guessing per account (counted whether or not the account exists)
        const key = limiterKey('login', email);
        if (await rateLimited(key, MAX_ATTEMPTS, WINDOW_SECONDS)) {
            await audit(null, { action: 'LOGIN_FAILED', entity: 'SESSION', outcome: 'DENIED', details: { email, reason: 'rate_limited' } });
            return NextResponse.json({ message: 'Too many sign-in attempts. Please try again in a few minutes.' }, { status: 429 });
        }

        // 3. Verify credentials. Unknown email, wrong password and unverified-but-wrong-password all look the same.
        const user = await AuthService.getUserByEmailWithPassword(email);
        if (!user) {
            await AuthService.fakeCompare(password);
            await audit(null, { action: 'LOGIN_FAILED', entity: 'SESSION', outcome: 'FAILURE', details: { email, reason: 'bad_credentials' } });
            return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
        }

        const isValid = await AuthService.comparePassword(password, user.password_hash);
        if (!isValid) {
            await audit(null, { action: 'LOGIN_FAILED', entity: 'SESSION', outcome: 'FAILURE', details: { email, reason: 'bad_credentials', accountId: user.id } });
            return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
        }

        // Only someone who knows the password learns the account is unverified
        if (!user.is_verified) {
            await audit(null, { action: 'LOGIN_FAILED', entity: 'SESSION', outcome: 'FAILURE', details: { email, reason: 'unverified', accountId: user.id } });
            return NextResponse.json({ message: 'Email not verified. Please verify your email to log in.' }, { status: 403 });
        }

        await clearLimit(key);

        // 4. Generate Token (JWT) and set it as an httpOnly cookie. It is deliberately not returned in the body.
        const token = await AuthService.generateToken(user);
        (await cookies()).set({
            name: 'token',
            value: token,
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24, // 1 day
        });

        await audit({ id: user.id, role: user.role, name: user.name }, { action: 'LOGIN', entity: 'SESSION' });

        // 5. Return standard user object (without secrets)
        const { password_hash, ...userWithoutPassword } = user;

        return NextResponse.json({
            message: 'Login successful',
            user: userWithoutPassword,
        });

    } catch (error: any) {
        console.error('Login Error:', error);
        return handleError(error);
    }
}
