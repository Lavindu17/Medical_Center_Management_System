import { NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { parseBody } from '@/lib/validate';
import { requirePermission } from '@/lib/api-auth';
import { grantsFor } from '@/lib/access/resolve';
import { isStaffRole } from '@/lib/access/defaults';
import { AccessError, conflictsIn, describeChange, grantsSchema, profileGrants, roleGrants, writeGrants } from '@/lib/access/admin';
import { accessFailure } from '@/lib/access/http';

async function staffUser(idText: string) {
    const id = Number(idText);
    if (!Number.isInteger(id) || id <= 0) throw new AccessError(400, 'Invalid user');
    const [user] = await query<any[]>('SELECT id, name, email, role FROM users WHERE id = ?', [id]);
    if (!user) throw new AccessError(404, 'User not found');
    if (user.role === 'PATIENT') throw new AccessError(400, 'Patients are the customer side. Their access is fixed and cannot be configured here.');
    return user as { id: number; name: string; email: string; role: string };
}

/** One person's access: the role they start from, profiles they were given, their own ticks, and what that adds up to. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requirePermission('access.config', 'view');
    if ('error' in auth) return auth.error;
    try {
        const user = await staffUser((await params).id);
        const role = isStaffRole(user.role) ? (await roleGrants(user.role)).grants : {};

        let assigned: { id: number; name: string; description: string | null }[] = [];
        let personal = {};
        try {
            assigned = await query<any[]>(
                `SELECT p.id, p.name, p.description FROM user_access_profiles uap JOIN access_profiles p ON p.id = uap.profile_id
                 WHERE uap.user_id = ? AND p.owner_user_id IS NULL AND p.system_role IS NULL ORDER BY p.name`, [user.id]);
            const [own] = await query<any[]>('SELECT id FROM access_profiles WHERE owner_user_id = ?', [user.id]);
            if (own) personal = await profileGrants(own.id);
        } catch (err: any) {
            if (err?.errno !== 1146) throw err;
        }
        const effective = await grantsFor(user);
        return NextResponse.json({ user, role, assigned, personal, effective, warnings: conflictsIn(effective) });
    } catch (err) {
        return accessFailure(err, 'Access user detail');
    }
}

const putSchema = z.object({
    profileIds: z.array(z.number().int().positive()).max(30).transform((v) => [...new Set(v)]),
    personal: grantsSchema,
});

/** Sets the profiles a person has and their own extra ticks. Takes effect on their next click. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requirePermission('access.config', 'change');
    if ('error' in auth) return auth.error;
    const body = await parseBody(req, putSchema);
    if ('error' in body) return body.error;
    const user0 = await staffUser((await params).id).catch((err) => err as AccessError);
    if (user0 instanceof AccessError) return accessFailure(user0, 'Access user save');
    const user = user0;
    const { profileIds, personal } = body.data;

    // Two administrators saving the same person at once take turns (the person's row is the lock); a rare lost race is retried
    for (let attempt = 1; ; attempt++) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.execute('SELECT id FROM users WHERE id = ? FOR UPDATE', [user.id]);

        if (profileIds.length > 0) {
            const [found]: any = await connection.query(
                'SELECT id FROM access_profiles WHERE id IN (?) AND owner_user_id IS NULL AND system_role IS NULL', [profileIds]);
            if (found.length !== profileIds.length) throw new AccessError(400, 'One of those profiles does not exist.');
        }
        const [oldOwn]: any = await connection.execute('SELECT id FROM access_profiles WHERE owner_user_id = ?', [user.id]);
        const before = oldOwn[0] ? await profileGrants(oldOwn[0].id) : {};

        await connection.execute(
            'DELETE uap FROM user_access_profiles uap JOIN access_profiles p ON p.id = uap.profile_id WHERE uap.user_id = ? AND p.owner_user_id IS NULL AND p.system_role IS NULL', [user.id]);
        for (const id of profileIds) await connection.execute('INSERT INTO user_access_profiles (user_id, profile_id) VALUES (?, ?)', [user.id, id]);

        // The person's own ticks live in a small profile of their own, linked like any other
        const ticked = Object.keys(personal).length > 0;
        if (ticked) {
            let ownId: number = oldOwn[0]?.id;
            if (!ownId) {
                const [res]: any = await connection.execute('INSERT INTO access_profiles (name, owner_user_id) VALUES (?, ?)', [`__personal_${user.id}`, user.id]);
                ownId = res.insertId;
            }
            await connection.execute('INSERT IGNORE INTO user_access_profiles (user_id, profile_id) VALUES (?, ?)', [user.id, ownId]);
            await writeGrants(connection, ownId, personal, Object.keys(personal) as any);
        } else if (oldOwn[0]) {
            await connection.execute('DELETE FROM access_profiles WHERE id = ?', [oldOwn[0].id]);
        }
        await connection.commit();

        await audit(auth.user, { action: 'UPDATE', entity: 'ACCESS', entityId: user.id, details: { person: user.name, profiles: profileIds, changes: describeChange(before, personal) } });
        return NextResponse.json({ message: 'Saved' });
    } catch (err) {
        await connection.rollback().catch(() => {});
        if (((err as any)?.errno === 1213 || (err as any)?.errno === 1205) && attempt < 4) continue;
        return accessFailure(err, 'Access user save');
    } finally {
        connection.release();
    }
    }
}
