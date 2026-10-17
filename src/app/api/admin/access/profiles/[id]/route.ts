import { NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { parseBody } from '@/lib/validate';
import { requirePermission } from '@/lib/api-auth';
import { AccessError, describeChange, grantsSchema, profileDescriptionSchema, profileGrants, profileNameSchema, writeGrants, ADMIN_ONLY, grantsAccessControl, profilesHoldAccessControl } from '@/lib/access/admin';
import { accessFailure } from '@/lib/access/http';

async function customProfile(idText: string) {
    const id = Number(idText);
    if (!Number.isInteger(id) || id <= 0) throw new AccessError(400, 'Invalid profile');
    const [p] = await query<any[]>('SELECT id, name FROM access_profiles WHERE id = ? AND owner_user_id IS NULL AND system_role IS NULL', [id]);
    if (!p) throw new AccessError(404, 'Profile not found');
    return p as { id: number; name: string };
}

const putSchema = z.object({ name: profileNameSchema, description: profileDescriptionSchema, grants: grantsSchema });

/** Change a profile's name, description and ticks. Everyone who holds it is affected on their next click. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requirePermission('access.config', 'change');
    if ('error' in auth) return auth.error;
    const body = await parseBody(req, putSchema);
    if ('error' in body) return body.error;
    if (auth.user.role !== 'ADMIN' && grantsAccessControl(body.data.grants)) return accessFailure(ADMIN_ONLY, 'Access profile save');
    const connection = await pool.getConnection();
    try {
        const profile = await customProfile((await params).id);
        if (auth.user.role !== 'ADMIN' && await profilesHoldAccessControl([profile.id])) throw ADMIN_ONLY;
        const before = await profileGrants(profile.id);
        await connection.beginTransaction();
        await connection.execute('UPDATE access_profiles SET name = ?, description = ? WHERE id = ?', [body.data.name, body.data.description, profile.id]);
        await writeGrants(connection, profile.id, body.data.grants, Object.keys(body.data.grants) as any);
        await connection.commit();
        await audit(auth.user, { action: 'UPDATE', entity: 'ACCESS', entityId: profile.id, details: { profile: body.data.name, changes: describeChange(before, body.data.grants) } });
        return NextResponse.json({ message: 'Saved' });
    } catch (err) {
        await connection.rollback().catch(() => {});
        return accessFailure(err, 'Access profile save');
    } finally {
        connection.release();
    }
}

/** Delete a profile. The people who held it simply lose what it gave them. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requirePermission('access.config', 'change');
    if ('error' in auth) return auth.error;
    try {
        const profile = await customProfile((await params).id);
        if (auth.user.role !== 'ADMIN' && await profilesHoldAccessControl([profile.id])) throw ADMIN_ONLY;
        const [n] = await query<any[]>('SELECT COUNT(*) AS n FROM user_access_profiles WHERE profile_id = ?', [profile.id]);
        await query('DELETE FROM access_profiles WHERE id = ?', [profile.id]);
        await audit(auth.user, { action: 'DELETE', entity: 'ACCESS', entityId: profile.id, details: { profile: profile.name, peopleAffected: Number(n.n) } });
        return NextResponse.json({ message: 'Deleted' });
    } catch (err) {
        return accessFailure(err, 'Access profile delete');
    }
}
