import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { accessFailure } from '@/lib/access/http';

/** Staff to configure: search by name or email. Patients are the customer side and are not listed. */
export async function GET(req: Request) {
    const auth = await requirePermission('access.config', 'view');
    if ('error' in auth) return auth.error;
    try {
        const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 60);
        const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
        const users = await query<any[]>(
            `SELECT id, name, email, role FROM users WHERE role <> 'PATIENT' AND (? = '' OR name LIKE ? OR email LIKE ?) ORDER BY name LIMIT 60`, [q, like, like]);
        let withProfiles = new Map<number, string[]>();
        try {
            const rows = await query<any[]>(
                `SELECT uap.user_id, p.name FROM user_access_profiles uap JOIN access_profiles p ON p.id = uap.profile_id
                 WHERE p.owner_user_id IS NULL AND p.system_role IS NULL AND uap.user_id IN (${users.map(() => '?').join(',') || 'NULL'})`, users.map((u) => u.id));
            for (const r of rows) withProfiles.set(r.user_id, [...(withProfiles.get(r.user_id) ?? []), r.name]);
        } catch (err: any) {
            if (err?.errno !== 1146) throw err;
        }
        return NextResponse.json(users.map((u) => ({ ...u, profiles: withProfiles.get(u.id) ?? [] })));
    } catch (err) {
        return accessFailure(err, 'Access users list');
    }
}
