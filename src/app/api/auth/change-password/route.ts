import { NextResponse } from 'next/server';
import { z } from 'zod';
import { audit } from '@/lib/audit';
import { parseBody } from '@/lib/validate';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';
import { query } from '@/lib/db';
import { clearLimit, limiterKey, rateLimited } from '@/lib/rate-limit';

const required = 'Missing required fields';
const changePasswordSchema = z.object({
    currentPassword: z.string({ message: required }).min(1, required),
    newPassword: z.string({ message: required }).min(1, required)
        .min(6, 'New password must be at least 6 characters')
        .refine((v) => Buffer.byteLength(v) <= 72, 'Password is too long (72 bytes maximum)'),
}).refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'], message: 'The new password must be different from the current one',
});

export async function POST(req: Request) {
    try {
        const token = (await cookies()).get('token')?.value;
        const payload = token ? await AuthService.verifyToken(token) : null;
        if (!payload) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await parseBody(req, changePasswordSchema);
        if ('error' in body) return body.error;
        const { currentPassword, newPassword } = body.data;

        // A stolen session must not be able to grind through the current password
        const key = limiterKey('change-password', String(payload.id));
        if (await rateLimited(key, 5, 15 * 60)) {
            return NextResponse.json({ message: 'Too many attempts. Please try again in a few minutes.' }, { status: 429 });
        }

        const users = await query<any[]>('SELECT * FROM users WHERE id = ?', [payload.id]);
        if (users.length === 0) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }
        const user = users[0];

        const isValid = await AuthService.comparePassword(currentPassword, user.password_hash);
        if (!isValid) {
            await audit({ id: user.id, role: user.role, name: user.name }, { action: 'PASSWORD_CHANGE', entity: 'USER', entityId: user.id, outcome: 'FAILURE', details: { reason: 'wrong_current_password' } });
            return NextResponse.json({ message: 'Incorrect current password' }, { status: 400 });
        }

        // password_changed_at signs out every other session (for example a stolen cookie)
        const newHash = await AuthService.hashPassword(newPassword);
        await query('UPDATE users SET password_hash = ?, password_changed_at = NOW() WHERE id = ?', [newHash, user.id]);
        await clearLimit(key);
        await audit({ id: user.id, role: user.role, name: user.name }, { action: 'PASSWORD_CHANGE', entity: 'USER', entityId: user.id });

        // Keep the person who just changed it signed in on this device with a fresh token
        (await cookies()).set({
            name: 'token',
            value: await AuthService.generateToken(user),
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24,
        });

        return NextResponse.json({ success: true, message: 'Password updated successfully' });

    } catch (error) {
        console.error('Change Password Error:', error);
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}
