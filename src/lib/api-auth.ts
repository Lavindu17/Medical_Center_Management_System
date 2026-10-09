import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { audit } from '@/lib/audit';
import type { Role } from '@/types';

export interface SessionUser {
    id: number;
    email: string;
    name: string;
    role: Role;
    /** Set when a family member is acting as this account: the real person behind the session */
    actorId?: number;
    actorName?: string;
}

/** Reads the `token` cookie and returns the verified user, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
    const token = (await cookies()).get('token')?.value;
    if (!token) return null;
    const payload = await AuthService.verifyToken(token);
    if (!payload || typeof payload.id !== 'number' || typeof payload.role !== 'string') return null;
    return payload as unknown as SessionUser;
}

/**
 * Guard for route handlers: 401 when not signed in, 403 when the role is not allowed.
 *
 *   const auth = await requireRole('ADMIN');
 *   if ('error' in auth) return auth.error;
 *   const { user } = auth;
 */
export async function requireRole(...roles: Role[]): Promise<{ user: SessionUser } | { error: NextResponse }> {
    const user = await getSessionUser();
    if (!user) return { error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) };
    if (roles.length > 0 && !roles.includes(user.role)) {
        await audit(user, { action: 'ACCESS_DENIED', outcome: 'DENIED', details: { requiredRoles: roles.join(',') } });
        return { error: NextResponse.json({ message: 'Forbidden' }, { status: 403 }) };
    }
    return { user };
}
