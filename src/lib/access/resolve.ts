import { query } from '@/lib/db';
import { LEVELS, RESOURCE_KEYS, isResource, type Level, type ResourceKey } from './registry';
import { ALWAYS_ADMIN, ROLE_DEFAULTS, isStaffRole, mergeGrants, normalise, type GrantMap } from './defaults';

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
 * Everything a person may do, as a map of screen to levels.
 *
 *   administrators      like staff, and always able to change access (so nobody can be locked out of configuring it)
 *   staff               their role's default profile (the stored copy where the site has edited it, otherwise the built-in
 *                       defaults), plus any profiles they were given, plus their own extra ticks
 *   patients and others nothing: the customer side is not configurable
 *
 * Read fresh on each request, so a change takes effect on the person's next click.
 */
export async function grantsFor(user: { id: number; role: string }): Promise<GrantMap> {
    let result: GrantMap = isStaffRole(user.role) ? { ...ROLE_DEFAULTS[user.role] } : {};

    let rows: Row[] = [];
    try {
        const found = await query<Row[]>(
            `SELECT p.id AS profile_id, p.system_role, g.resource, g.can_view, g.can_add, g.can_change, g.can_approve
             FROM access_profiles p LEFT JOIN access_grants g ON g.profile_id = p.id
             WHERE p.system_role = ? OR p.id IN (SELECT profile_id FROM user_access_profiles WHERE user_id = ?)`,
            [user.role, user.id]);
        rows = Array.isArray(found) ? found : [];
    } catch (err: any) {
        if (err?.errno !== 1146) throw err;   // 22_access_control.sql not applied yet: the built-in defaults apply
    }

    // The role's own stored profile replaces the built-in defaults, resource by resource
    const roleRows = rows.filter((r) => r.system_role === user.role);
    if (roleRows.length > 0) {
        for (const r of roleRows) if (r.resource && isResource(r.resource)) result[r.resource] = rowGrant(r);
    }

    // Other profiles (given by hand, or the person's own ticks) add to it
    const extra: GrantMap = {};
    for (const r of rows.filter((x) => x.system_role !== user.role && x.resource && isResource(x.resource))) {
        const key = r.resource as ResourceKey;
        extra[key] = { ...(extra[key] ?? {}), ...rowGrant(r) };
    }
    result = mergeGrants(result, extra);

    const out: GrantMap = {};
    for (const key of RESOURCE_KEYS) if (result[key]) out[key] = normalise(key, result[key]!);
    if (user.role === 'ADMIN') out[ALWAYS_ADMIN] = { view: true, change: true };
    return out;
}

/** Whether a grant map allows a level on a screen. */
export function allows(grants: GrantMap, resource: ResourceKey, level: Level): boolean {
    return Boolean(grants[resource]?.[level]);
}
