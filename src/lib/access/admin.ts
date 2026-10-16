import { z } from 'zod';
import { query } from '@/lib/db';
import { LEVELS, RESOURCE_KEYS, RESOURCES, isResource, levelsOf, type Level, type ResourceKey } from './registry';
import { ROLE_DEFAULTS, isStaffRole, normalise, type Grant, type GrantMap, type StaffRole } from './defaults';

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

/** What a role gets: the site's stored copy where it has one (over the built-in defaults, screen by screen), else the defaults. */
export async function roleGrants(role: StaffRole): Promise<{ grants: GrantMap; customised: boolean }> {
    const base: GrantMap = { ...ROLE_DEFAULTS[role] };
    let rows: any[] = [];
    try {
        rows = await query<any[]>(
            `SELECT g.resource, g.can_view, g.can_add, g.can_change, g.can_approve FROM access_profiles p
             JOIN access_grants g ON g.profile_id = p.id WHERE p.system_role = ?`, [role]);
    } catch (err: any) {
        if (err?.errno !== 1146) throw err;
    }
    const stored = rowsToGrants(rows);
    return { grants: { ...base, ...stored }, customised: rows.length > 0 };
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

/** Combinations worth a second look (not blocked: a small clinic may need one person to do both). */
export const CONFLICTS: { a: [ResourceKey, Level]; b: [ResourceKey, Level]; message: string }[] = [
    { a: ['pharmacy.dispensing', 'approve'], b: ['pharmacy.inventory', 'change'], message: 'Can dispense medicines and also edit stock, so a missing medicine could be hidden by changing the stock.' },
    { a: ['consultations', 'approve'], b: ['pharmacy.dispensing', 'approve'], message: 'Can complete consultations and dispense the prescription they wrote.' },
    { a: ['hr.attendance', 'change'], b: ['hr.attendance', 'approve'], message: 'Can edit attendance records and also approve corrections to them.' },
    { a: ['billing', 'approve'], b: ['admin.revenue', 'view'], message: 'Can record payments and also see the revenue figures that include them.' },
];

export function conflictsIn(grants: GrantMap): string[] {
    return CONFLICTS.filter((c) => grants[c.a[0]]?.[c.a[1]] && grants[c.b[0]]?.[c.b[1]]).map((c) => c.message);
}

export { RESOURCES, levelsOf, isStaffRole };
