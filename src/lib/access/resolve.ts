import { query } from '@/lib/db';
import { LEVELS, RESOURCE_KEYS, isResource, type Level, type ResourceKey } from './registry';
import { ALWAYS_ADMIN, mergeGrants, normalise, type GrantMap } from './defaults';

interface Row {
    profile_id: number | null;
    system_role: string | null;
    resource: string | null;
    can_view: number | null; can_add: number | null; can_change: number | null; can_approve: number | null;
}

const FLAG: Record<Level, keyof Row> = { view: 'can_view', add: 'can_add', change: 'can_change', approve: 'can_approve' };

function rowGrant(r: Row) {
    return Object.fromEntries(LEVELS.filter((l) => Number(r[FLAG[l]]) === 1).map((l) => [l, true]));
}

/**
 * Everything a person may do, as a map of screen to levels. The database is the only source: nothing stored means nothing
 * allowed. It is the union of
 *
 *   their role's profile       (what the job starts with at this site)
 *   profiles they were given   ("Pharmacist with billing")
 *   their own extra ticks
 *
 * The one fixed rule: an administrator can always open the access window, so a site can never lock itself out of
 * configuring it. Patients are the customer side and get nothing here.
 *
 * Read fresh on each request, so a change takes effect on the person's next click.
 */
export async function grantsFor(user: { id: number; role: string }): Promise<GrantMap> {
    let rows: Row[] = [];
    if (user.role !== 'PATIENT') {
        try {
            const found = await query<Row[]>(
                `SELECT p.id AS profile_id, p.system_role, g.resource, g.can_view, g.can_add, g.can_change, g.can_approve
                 FROM access_profiles p JOIN access_grants g ON g.profile_id = p.id
                 WHERE p.system_role = ? OR p.id IN (SELECT profile_id FROM user_access_profiles WHERE user_id = ?)`,
                [user.role, user.id]);
            rows = Array.isArray(found) ? found : [];
        } catch (err: any) {
            if (err?.errno !== 1146) throw err;   // the tables are missing: nothing is allowed (never fail open)
        }
    }

    let result: GrantMap = {};
    for (const r of rows) {
        if (!r.resource || !isResource(r.resource)) continue;
        const key = r.resource as ResourceKey;
        result = mergeGrants(result, { [key]: rowGrant(r) });
    }

    const out: GrantMap = {};
    for (const key of RESOURCE_KEYS) {
        const g = result[key] ? normalise(key, result[key]!) : {};
        if (Object.keys(g).length > 0) out[key] = g;         // a screen with nothing ticked is simply absent
    }
    if (user.role === 'ADMIN') out[ALWAYS_ADMIN] = { view: true, change: true };
    return out;
}

/** Whether a grant map allows a level on a screen. */
export function allows(grants: GrantMap, resource: ResourceKey, level: Level): boolean {
    return Boolean(grants[resource]?.[level]);
}
