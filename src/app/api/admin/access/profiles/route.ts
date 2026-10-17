import { NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { parseBody } from '@/lib/validate';
import { requirePermission } from '@/lib/api-auth';
import { STAFF_ROLES } from '@/lib/access/defaults';
import { grantsSchema, profileDescriptionSchema, profileNameSchema, rowsToGrants, roleGrants, writeGrants, ADMIN_ONLY, grantsAccessControl } from '@/lib/access/admin';
import { accessFailure } from '@/lib/access/http';

/**
 * Everything the Profiles tab shows: each role's starting profile (the site's copy, or the built-in one) and the profiles
 * the site created, with how many people hold each.
 */
export async function GET() {
    const auth = await requirePermission('access.config', 'view');
    if ('error' in auth) return auth.error;
    try {
        const roles = await Promise.all(STAFF_ROLES.map(async (role) => {
            const { grants, customised, stored, missing } = await roleGrants(role);
            const [n] = await query<any[]>('SELECT COUNT(*) AS n FROM users WHERE role = ?', [role]);
            return { role, grants, customised, stored, missing, people: Number(n.n) };
        }));

        let custom: any[] = [];
        try {
            const profiles = await query<any[]>(
                `SELECT p.id, p.name, p.description, (SELECT COUNT(*) FROM user_access_profiles u WHERE u.profile_id = p.id) AS people
                 FROM access_profiles p WHERE p.owner_user_id IS NULL AND p.system_role IS NULL ORDER BY p.name`);
            const rows = profiles.length === 0 ? [] : await query<any[]>(
                `SELECT profile_id, resource, can_view, can_add, can_change, can_approve FROM access_grants WHERE profile_id IN (${profiles.map(() => '?').join(',')})`, profiles.map((p) => p.id));
            custom = profiles.map((p) => ({ id: p.id, name: p.name, description: p.description, people: Number(p.people), grants: rowsToGrants(rows.filter((r) => r.profile_id === p.id)) }));
        } catch (err: any) {
            if (err?.errno !== 1146) throw err;
            return NextResponse.json({ roles, custom: [], ready: false });
        }
        return NextResponse.json({ roles, custom, ready: true });
    } catch (err) {
        return accessFailure(err, 'Access profiles list');
    }
}

const createSchema = z.object({ name: profileNameSchema, description: profileDescriptionSchema, grants: grantsSchema });

/** Create a profile: a named set of ticks that can be given to any number of people. */
export async function POST(req: Request) {
    const auth = await requirePermission('access.config', 'change');
    if ('error' in auth) return auth.error;
    const body = await parseBody(req, createSchema);
    if ('error' in body) return body.error;
    if (auth.user.role !== 'ADMIN' && grantsAccessControl(body.data.grants)) return accessFailure(ADMIN_ONLY, 'Access profile create');
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [res]: any = await connection.execute('INSERT INTO access_profiles (name, description) VALUES (?, ?)', [body.data.name, body.data.description]);
        await writeGrants(connection, res.insertId, body.data.grants, Object.keys(body.data.grants) as any);
        await connection.commit();
        await audit(auth.user, { action: 'CREATE', entity: 'ACCESS', entityId: res.insertId, details: { profile: body.data.name } });
        return NextResponse.json({ id: res.insertId }, { status: 201 });
    } catch (err) {
        await connection.rollback().catch(() => {});
        return accessFailure(err, 'Access profile create');
    } finally {
        connection.release();
    }
}
