import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { grantsFor } from '@/lib/access/resolve';
import { isResource, levelsOf } from '@/lib/access/registry';
import { AccessError } from '@/lib/access/admin';
import { accessFailure } from '@/lib/access/http';

/** Who can do what on one screen: every member of staff with at least one level on it. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
    const auth = await requirePermission('access.config', 'view');
    if ('error' in auth) return auth.error;
    try {
        const key = decodeURIComponent((await params).key);
        if (!isResource(key)) throw new AccessError(404, 'That screen does not exist');
        const staff = await query<any[]>("SELECT id, name, email, role FROM users WHERE role <> 'PATIENT' ORDER BY name");
        const people = [];
        for (const u of staff) {
            const g = (await grantsFor(u))[key];
            if (g && Object.keys(g).length > 0) people.push({ ...u, levels: levelsOf(key).filter((l) => g[l]) });
        }
        return NextResponse.json({ screen: key, people });
    } catch (err) {
        return accessFailure(err, 'Access screen lookup');
    }
}
