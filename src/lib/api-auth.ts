import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { audit } from '@/lib/audit';
import type { Role } from '@/types';
import { allows, grantsFor } from '@/lib/access/resolve';
import type { Level, ResourceKey } from '@/lib/access/registry';

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

// ---------------------------------------------------------------------------------------------------------------------
// Configurable access (staff). Patients are the customer side and keep their fixed rules (requireRole('PATIENT')).
// ---------------------------------------------------------------------------------------------------------------------

/** One way to be let in: be a patient, or hold a level on a screen. */
export type AccessRule = 'PATIENT' | readonly [ResourceKey, Level];

const ruleText = (r: AccessRule) => (r === 'PATIENT' ? 'PATIENT' : `${r[0]}:${r[1]}`);

/**
 * Guard for route handlers: 401 when not signed in, 403 unless one of the rules lets the person in.
 *
 *   const auth = await requirePermission('billing', 'approve');
 *   const auth = await requireAccess('PATIENT', ['reception.appointments', 'view'], ['consultations', 'view']);
 *   if ('error' in auth) return auth.error;
 */
export async function requireAccess(...rules: AccessRule[]): Promise<{ user: SessionUser } | { error: NextResponse }> {
    const user = await getSessionUser();
    if (!user) return { error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) };

    if (user.role === 'PATIENT') {
        if (rules.includes('PATIENT')) return { user };
    } else {
        const wanted = rules.filter((r): r is readonly [ResourceKey, Level] => r !== 'PATIENT');
        if (wanted.length > 0) {
            const grants = await grantsFor(user);
            if (wanted.some(([resource, level]) => allows(grants, resource, level))) return { user };
        }
    }
    await audit(user, { action: 'ACCESS_DENIED', outcome: 'DENIED', details: { required: rules.map(ruleText).join(' or ') } });
    return { error: NextResponse.json({ message: 'Forbidden' }, { status: 403 }) };
}

export const requirePermission = (resource: ResourceKey, level: Level) => requireAccess([resource, level]);

/** For pages and menus: what this person may do on a screen. */
export async function userCan(user: { id: number; role: string }, resource: ResourceKey, level: Level): Promise<boolean> {
    if (user.role === 'PATIENT') return false;
    return allows(await grantsFor(user), resource, level);
}
