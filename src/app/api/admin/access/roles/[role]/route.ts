import { NextResponse } from 'next/server';
import { z } from 'zod';
import { pool } from '@/lib/db';
import { audit } from '@/lib/audit';
import { parseBody } from '@/lib/validate';
import { requirePermission } from '@/lib/api-auth';
import { ALWAYS_ADMIN, STAFF_ROLES, isStaffRole, type StaffRole } from '@/lib/access/defaults';
import { AccessError, describeChange, grantsSchema, resetRole, roleGrants, writeGrants } from '@/lib/access/admin';
import { accessFailure } from '@/lib/access/http';

const roleOf = (text: string): StaffRole => {
    const role = decodeURIComponent(text).toUpperCase();
    if (!isStaffRole(role)) throw new AccessError(404, `Unknown role. Choose one of: ${STAFF_ROLES.join(', ')}`);
    return role;
};

const putSchema = z.object({ grants: grantsSchema });

/** Change what a whole role has at this site (everyone with the role is affected on their next click). */
export async function PUT(req: Request, { params }: { params: Promise<{ role: string }> }) {
    const auth = await requirePermission('access.config', 'change');
    if ('error' in auth) return auth.error;
    const body = await parseBody(req, putSchema);
    if ('error' in body) return body.error;
    const connection = await pool.getConnection();
    try {
        const role = roleOf((await params).role);
        const { grants: before } = await roleGrants(role);
        // Administrators can always change access, so a site cannot lock itself out
        const grants = role === 'ADMIN' ? { ...body.data.grants, [ALWAYS_ADMIN]: { view: true, change: true } } : body.data.grants;

        await connection.beginTransaction();
        const [found]: any = await connection.execute('SELECT id FROM access_profiles WHERE system_role = ?', [role]);
        let profileId: number = found[0]?.id;
        if (!profileId) {
            const [res]: any = await connection.execute('INSERT INTO access_profiles (name, system_role) VALUES (?, ?)', [`Role: ${role}`, role]);
            profileId = res.insertId;
        }
        await writeGrants(connection, profileId, grants);          // a row for every screen, so "nothing" stays nothing
        await connection.commit();
        await audit(auth.user, { action: 'UPDATE', entity: 'ACCESS', entityId: profileId, details: { role, changes: describeChange(before, grants) } });
        return NextResponse.json({ message: 'Saved' });
    } catch (err) {
        await connection.rollback().catch(() => {});
        return accessFailure(err, 'Access role save');
    } finally {
        connection.release();
    }
}

/** Put a role back to the starting point it began with (also how a role with nothing stored gets its permissions). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ role: string }> }) {
    const auth = await requirePermission('access.config', 'change');
    if ('error' in auth) return auth.error;
    const connection = await pool.getConnection();
    try {
        const role = roleOf((await params).role);
        await connection.beginTransaction();
        const profileId = await resetRole(connection, role);
        await connection.commit();
        await audit(auth.user, { action: 'UPDATE', entity: 'ACCESS', entityId: profileId, details: { role, reset: 'starting point' } });
        return NextResponse.json({ message: 'Reset' });
    } catch (err) {
        await connection.rollback().catch(() => {});
        return accessFailure(err, 'Access role reset');
    } finally {
        connection.release();
    }
}
