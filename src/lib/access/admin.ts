import { z } from 'zod';
import { query } from '@/lib/db';
import { LEVELS, RESOURCE_KEYS, RESOURCES, isResource, levelsOf, type Level, type ResourceKey } from './registry';
import { ROLE_TEMPLATES, isStaffRole, normalise, type Grant, type GrantMap, type StaffRole } from './defaults';
import { templateRows } from './seed';

/** Used by the configuration window: reading and writing profiles. The checks that decide access are in resolve.ts. */

const FLAG: Record<Level, string> = { view: 'can_view', add: 'can_add', change: 'can_change', approve: 'can_approve' };

const grantSchema = z.object({
    view: z.boolean().optional(), add: z.boolean().optional(), change: z.boolean().optional(), approve: z.boolean().optional(),
});

/** A map of screen to ticks. Unknown screens are rejected; ticks the screen does not offer are dropped; add/change/approve bring view. */
export const grantsSchema = z.record(z.string(), grantSchema).transform((raw, ctx) => {
    const out: GrantMap = {};
    for (const [key, grant] of Object.entries(raw)) {
        if (!isResource(key)) {
            ctx.addIssue({ code: 'custom', message: `"${key}" is not a screen in this system` });
            return z.NEVER;
        }
        const clean = normalise(key, grant as Grant);
        if (Object.keys(clean).length > 0) out[key] = clean;
    }
    return out;
});

export const profileNameSchema = z.string().trim().min(2, 'Give the profile a name (at least 2 letters)').max(80, 'The name is too long');
export const profileDescriptionSchema = z.string().trim().max(255).nullish().transform((v) => v || null);

export class AccessError extends Error {
    constructor(public status: number, message: string) { super(message); }
}

export const NOT_READY = new AccessError(409, 'Permissions cannot be saved yet: the 22_access_control.sql update has not been applied to the database.');

/** Rows of a profile as a map. */
export function rowsToGrants(rows: any[]): GrantMap {
    const out: GrantMap = {};
    for (const r of rows) {
        if (!r.resource || !isResource(r.resource)) continue;
        const g: Grant = {};
        for (const l of LEVELS) if (Number(r[FLAG[l]]) === 1) g[l] = true;
        out[r.resource as ResourceKey] = g;
    }
    return out;
}

/** The ticks of one profile. */
export async function profileGrants(profileId: number): Promise<GrantMap> {
    return rowsToGrants(await query<any[]>('SELECT resource, can_view, can_add, can_change, can_approve FROM access_grants WHERE profile_id = ?', [profileId]));
}

/** What a role gets at this site: what is stored, and whether that differs from the starting point it began with. */
export async function roleGrants(role: StaffRole): Promise<{ grants: GrantMap; customised: boolean; stored: boolean; missing: ResourceKey[] }> {
    let rows: any[] = [];
    try {
        rows = await query<any[]>(
            `SELECT g.resource, g.can_view, g.can_add, g.can_change, g.can_approve FROM access_profiles p
             JOIN access_grants g ON g.profile_id = p.id WHERE p.system_role = ?`, [role]);
    } catch (err: any) {
        if (err?.errno !== 1146) throw err;
    }
    const grants = rowsToGrants(Array.isArray(rows) ? rows : []);
    const same = (a: GrantMap, b: GrantMap) => RESOURCE_KEYS.every((k) => JSON.stringify(normalise(k, a[k] ?? {})) === JSON.stringify(normalise(k, b[k] ?? {})));
    const have = new Set((rows as any[]).map((r) => r.resource));
    // Screens added after this role was set up have no row, so they are closed to it until someone ticks them (or adds them)
    const missing = rows.length > 0 ? RESOURCE_KEYS.filter((k) => !have.has(k)) : [];
    return { grants, stored: rows.length > 0, missing, customised: rows.length > 0 && missing.length === 0 && !same(grants, ROLE_TEMPLATES[role]) };
}

/** The role's profile row, created if it does not exist yet (safe when two requests race) and locked until the transaction ends. */
export async function lockRoleProfile(db: { execute: (sql: string, p?: any[]) => Promise<any> }, role: StaffRole): Promise<number> {
    await db.execute('INSERT IGNORE INTO access_profiles (name, system_role) VALUES (?, ?)', [`Role: ${role}`, role]);
    const [found]: any = await db.execute('SELECT id FROM access_profiles WHERE system_role = ? FOR UPDATE', [role]);
    return found[0].id as number;
}

/** Adds a stored row (with the starting ticks) for each screen the role has none for. Never changes a row that exists. */
export async function fillMissing(db: { execute: (sql: string, p?: any[]) => Promise<any> }, role: StaffRole): Promise<number> {
    const [found]: any = await db.execute('SELECT id FROM access_profiles WHERE system_role = ? FOR UPDATE', [role]);
    if (!found[0]) return (await resetRole(db, role), RESOURCE_KEYS.length);
    let added = 0;
    for (const r of templateRows(role)) {
        const [res]: any = await db.execute('INSERT IGNORE INTO access_grants (profile_id, resource, can_view, can_add, can_change, can_approve) VALUES (?, ?, ?, ?, ?, ?)',
            [found[0].id, r.resource, r.view, r.add, r.change, r.approve]);
        added += Number(res.affectedRows ?? 0);
    }
    return added;
}

/** Writes the starting point back for a role (creating its profile if the database has none yet). */
export async function resetRole(db: { execute: (sql: string, p?: any[]) => Promise<any> }, role: StaffRole): Promise<number> {
    const profileId = await lockRoleProfile(db, role);
    await db.execute('DELETE FROM access_grants WHERE profile_id = ?', [profileId]);
    for (const r of templateRows(role)) {
        await db.execute('INSERT INTO access_grants (profile_id, resource, can_view, can_add, can_change, can_approve) VALUES (?, ?, ?, ?, ?, ?)',
            [profileId, r.resource, r.view, r.add, r.change, r.approve]);
    }
    return profileId;
}

/** Writes a full set of ticks (a row for every screen, so "nothing" is stored as nothing rather than falling back to a default). */
export async function writeGrants(db: { execute: (sql: string, p?: any[]) => Promise<any> }, profileId: number, grants: GrantMap, onlyKeys?: ResourceKey[]): Promise<void> {
    await db.execute('DELETE FROM access_grants WHERE profile_id = ?', [profileId]);
    for (const key of onlyKeys ?? RESOURCE_KEYS) {
        const g = normalise(key, grants[key] ?? {});
        await db.execute(
            'INSERT INTO access_grants (profile_id, resource, can_view, can_add, can_change, can_approve) VALUES (?, ?, ?, ?, ?, ?)',
            [profileId, key, +Boolean(g.view), +Boolean(g.add), +Boolean(g.change), +Boolean(g.approve)]);
    }
}

/** What changed between two sets of ticks, for the audit trail: "billing: view -> view, approve". */
export function describeChange(before: GrantMap, after: GrantMap): { screen: string; from: string; to: string }[] {
    const text = (g?: Grant) => LEVELS.filter((l) => g?.[l]).join(', ') || 'none';
    const out: { screen: string; from: string; to: string }[] = [];
    for (const key of RESOURCE_KEYS) {
        const a = text(normalise(key, before[key] ?? {})), b = text(normalise(key, after[key] ?? {}));
        if (a !== b) out.push({ screen: key, from: a, to: b });
    }
    return out;
}

export const isTablesMissing = (err: any) => err?.errno === 1146;

export { CONFLICTS, conflictsIn } from './conflicts';

export { RESOURCES, levelsOf, isStaffRole };

// Access to the configuration window itself is the most powerful thing there is: whoever holds it can give themselves
// anything. So only an administrator may hand it out, however many people are allowed to configure everything else.
export const ADMIN_ONLY = new AccessError(403, 'Only an administrator can give out access to the access configuration itself.');

/** True when these ticks include any access to the configuration window. */
export function grantsAccessControl(grants: GrantMap): boolean {
    const g = grants['access.config'];
    return Boolean(g && Object.values(g).some(Boolean));
}

/** True when any of these profiles includes access to the configuration window. */
export async function profilesHoldAccessControl(profileIds: number[]): Promise<boolean> {
    if (profileIds.length === 0) return false;
    const { pool } = await import('@/lib/db');
    const [found]: any = await pool.query(
        `SELECT 1 FROM access_grants WHERE profile_id IN (?) AND resource = 'access.config' AND (can_view OR can_add OR can_change OR can_approve) LIMIT 1`, [profileIds]);
    return found.length > 0;
}
