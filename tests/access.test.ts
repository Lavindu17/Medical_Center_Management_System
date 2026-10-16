import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { query } from '@/lib/db';
import { state } from './helpers/state';
import { tokenFor } from './helpers/auth';
import { LEVELS, RESOURCE_KEYS, RESOURCES, RESOURCE_LIST, levelsOf, MODULES } from '@/lib/access/registry';
import { ROLE_TEMPLATES, STAFF_ROLES, mergeGrants, normalise } from '@/lib/access/defaults';
import { templateRows } from '@/lib/access/seed';
import { allows, grantsFor } from '@/lib/access/resolve';
import { requireAccess, requirePermission } from '@/lib/api-auth';

// These tests use the real permission lookup against a pretend database.
beforeAll(() => { state.realAccess = true; });
afterAll(() => { state.realAccess = false; });

/** The rows a seeded site stores for a role, as the database returns them. */
const seededRows = (role: string) => (!(STAFF_ROLES as readonly string[]).includes(role) ? [] : templateRows(role as any)).map((r, i) => ({
    profile_id: 1, system_role: role, resource: r.resource, can_view: r.view, can_add: r.add, can_change: r.change, can_approve: r.approve, i,
}));
const row = (over: Record<string, unknown>) => ({ profile_id: 9, system_role: null, resource: null, can_view: 0, can_add: 0, can_change: 0, can_approve: 0, ...over });

/** Pretend database: knows the seeded role profiles, plus any extra rows a test adds. */
function database(extra: unknown[] = [], seeded = true) {
    vi.mocked(query).mockReset().mockImplementation((async (sql: string, params: any[]) =>
        /access_profiles/.test(sql) ? [...(seeded ? seededRows(params?.[0]) : []), ...extra] : []) as any);
}

describe('the catalogue', () => {
    it('lists each screen once, in a known module, offering view and a description of every level it offers', () => {
        expect(new Set(RESOURCE_KEYS).size).toBe(RESOURCE_KEYS.length);
        for (const r of RESOURCE_LIST) {
            expect(MODULES, r.key).toContain(r.module);
            expect(r.levels.view, `${r.key} must offer view`).toBeTruthy();
            for (const l of levelsOf(r.key)) expect(r.levels[l]!.length, `${r.key}.${l}`).toBeGreaterThan(2);
            expect(r.description.length).toBeGreaterThan(5);
        }
    });
    it('starting profiles only tick levels a screen offers', () => {
        for (const role of STAFF_ROLES) for (const [key, grant] of Object.entries(ROLE_TEMPLATES[role])) {
            for (const l of Object.keys(grant!)) expect(levelsOf(key as any), `${role} ${key}.${l}`).toContain(l);
        }
    });
    it('every staff role starts with its own work and account pages', () => {
        for (const role of STAFF_ROLES) {
            expect(ROLE_TEMPLATES[role]['my.work'], role).toEqual({ view: true, add: true });
            expect(ROLE_TEMPLATES[role]['my.account'], role).toEqual({ view: true, change: true });
        }
    });
});

describe('rules applied to a grant', () => {
    it('anything above view implies view', () => {
        expect(normalise('billing', { approve: true })).toEqual({ view: true, approve: true });
        expect(normalise('pharmacy.inventory', { change: true })).toEqual({ view: true, change: true });
    });
    it('drops levels the screen does not offer', () => {
        expect(normalise('pharmacy.alerts', { view: true, approve: true, add: true })).toEqual({ view: true });
        expect(normalise('billing', { add: true })).toEqual({});
    });
    it('merging allows a level when either side does', () => {
        const m = mergeGrants({ billing: { view: true } }, { billing: { approve: true }, 'pharmacy.alerts': { view: true } });
        expect(m.billing).toEqual({ view: true, approve: true });
        expect(m['pharmacy.alerts']).toEqual({ view: true });
    });
});

describe('only the database decides', () => {
    beforeEach(() => database([], false));

    it('with nothing stored, nobody can open anything', async () => {
        for (const role of ['DOCTOR', 'PHARMACIST', 'LAB_ASSISTANT', 'RECEPTIONIST', 'HR_MANAGER']) expect(await grantsFor({ id: 1, role }), role).toEqual({});
    });
    it('with nothing stored, an administrator can still open the access window (so the site can be set up), and nothing else', async () => {
        expect(await grantsFor({ id: 1, role: 'ADMIN' })).toEqual({ 'access.config': { view: true, change: true } });
    });
    it('when the tables are missing, nothing is allowed either (never fail open)', async () => {
        vi.mocked(query).mockReset().mockRejectedValue(Object.assign(new Error('no table'), { errno: 1146 }));
        expect(await grantsFor({ id: 1, role: 'PHARMACIST' })).toEqual({});
    });
    it('any other database error is not swallowed', async () => {
        vi.mocked(query).mockReset().mockRejectedValue(Object.assign(new Error('boom'), { errno: 1205 }));
        await expect(grantsFor({ id: 1, role: 'PHARMACIST' })).rejects.toThrow('boom');
    });
    it('profiles given to a person count even when the role has nothing stored', async () => {
        database([row({ resource: 'billing', can_view: 1 })], false);
        expect(allows(await grantsFor({ id: 5, role: 'PHARMACIST' }), 'billing', 'view')).toBe(true);
    });
    it('patients and unknown roles get nothing, and the database is not even asked for patients', async () => {
        database([row({ resource: 'billing', can_view: 1 })]);
        expect(await grantsFor({ id: 1, role: 'PATIENT' })).toEqual({});
        expect(vi.mocked(query)).not.toHaveBeenCalled();
        expect(await grantsFor({ id: 1, role: 'MYSTERY' })).toEqual({ billing: { view: true } });   // a stranger role only gets what was given to the person
    });
});

describe('what a seeded site gives each role (the old fixed rules)', () => {
    beforeEach(() => database());
    const can = async (role: string, resource: any, level: any) => allows(await grantsFor({ id: 1, role }), resource, level);

    it('the front desk books, checks in, registers and takes payments, and nothing else', async () => {
        for (const [r, l] of [['reception.appointments', 'add'], ['reception.appointments', 'change'], ['reception.patients', 'add'], ['billing', 'approve'], ['billing', 'view']] as const) expect(await can('RECEPTIONIST', r, l), `${r}.${l}`).toBe(true);
        for (const [r, l] of [['pharmacy.dispensing', 'view'], ['hr.leave', 'approve'], ['admin.revenue', 'view'], ['consultations', 'view']] as const) expect(await can('RECEPTIONIST', r, l), `${r}.${l}`).toBe(false);
    });
    it('the pharmacist dispenses and manages stock, but does not bill', async () => {
        expect(await can('PHARMACIST', 'pharmacy.dispensing', 'approve')).toBe(true);
        expect(await can('PHARMACIST', 'pharmacy.inventory', 'change')).toBe(true);
        expect(await can('PHARMACIST', 'billing', 'view')).toBe(false);
    });
    it('the doctor consults and completes, sees own earnings, and cannot dispense or see revenue', async () => {
        expect(await can('DOCTOR', 'consultations', 'approve')).toBe(true);
        expect(await can('DOCTOR', 'doctor.earnings', 'view')).toBe(true);
        expect(await can('DOCTOR', 'pharmacy.dispensing', 'view')).toBe(false);
        expect(await can('DOCTOR', 'admin.revenue', 'view')).toBe(false);
    });
    it('the lab assistant uploads results and nothing clinical beyond that', async () => {
        expect(await can('LAB_ASSISTANT', 'lab.requests', 'add')).toBe(true);
        expect(await can('LAB_ASSISTANT', 'consultations', 'view')).toBe(false);
    });
    it('the HR manager has all of HR and nothing outside it', async () => {
        for (const key of RESOURCE_KEYS.filter((k) => k.startsWith('hr.'))) for (const l of levelsOf(key)) expect(await can('HR_MANAGER', key, l), `${key}.${l}`).toBe(true);
        expect(await can('HR_MANAGER', 'billing', 'view')).toBe(false);
        expect(await can('HR_MANAGER', 'admin.users', 'view')).toBe(false);
    });
    it('the administrator runs the clinic but does not do clinical work', async () => {
        for (const key of RESOURCE_KEYS.filter((k) => k.startsWith('admin.') || k.startsWith('hr.') || k === 'access.config')) for (const l of levelsOf(key)) expect(await can('ADMIN', key, l), `${key}.${l}`).toBe(true);
        expect(await can('ADMIN', 'reception.appointments', 'change')).toBe(true);
        expect(await can('ADMIN', 'pharmacy.dispensing', 'approve')).toBe(false);
        expect(await can('ADMIN', 'consultations', 'view')).toBe(false);
    });
    it('every staff role can open its own work and account', async () => {
        for (const role of STAFF_ROLES) { expect(await can(role, 'my.work', 'add'), role).toBe(true); expect(await can(role, 'my.account', 'change'), role).toBe(true); }
    });
});

describe('profiles and edits stored in the database', () => {
    it('a profile given to a person adds to the role\'s (a pharmacist who also handles billing)', async () => {
        database([row({ resource: 'billing', can_view: 1, can_approve: 1 })]);
        const g = await grantsFor({ id: 5, role: 'PHARMACIST' });
        expect(allows(g, 'billing', 'approve')).toBe(true);
        expect(allows(g, 'billing', 'view')).toBe(true);
        expect(allows(g, 'pharmacy.dispensing', 'approve')).toBe(true);
    });
    it('removing a tick from the role\'s stored profile takes it away', async () => {
        const without = seededRows('PHARMACIST').map((r) => (r.resource === 'pharmacy.dispensing' ? { ...r, can_view: 0, can_approve: 0 } : r));
        vi.mocked(query).mockReset().mockResolvedValue(without as any);
        const g = await grantsFor({ id: 5, role: 'PHARMACIST' });
        expect(allows(g, 'pharmacy.dispensing', 'view')).toBe(false);
        expect(allows(g, 'pharmacy.inventory', 'change')).toBe(true);
    });
    it('a ticked add or approve brings view with it', async () => {
        database([row({ resource: 'hr.leave', can_approve: 1 })]);
        expect(allows(await grantsFor({ id: 5, role: 'DOCTOR' }), 'hr.leave', 'view')).toBe(true);
    });
    it('an administrator can always change access, even if the stored profile removes it', async () => {
        const without = seededRows('ADMIN').map((r) => (r.resource === 'access.config' || r.resource === 'admin.revenue' ? { ...r, can_view: 0, can_change: 0 } : r));
        vi.mocked(query).mockReset().mockResolvedValue(without as any);
        const g = await grantsFor({ id: 1, role: 'ADMIN' });
        expect(allows(g, 'access.config', 'change')).toBe(true);
        expect(allows(g, 'admin.revenue', 'view')).toBe(false);
    });
    it('unknown screens in the database are ignored', async () => {
        database([row({ resource: 'no.such.screen', can_view: 1 })], false);
        expect(await grantsFor({ id: 5, role: 'DOCTOR' })).toEqual({});
    });
});

describe('guards', () => {
    beforeEach(() => database());

    it('401 without a session, 403 without the permission, and the user when allowed', async () => {
        state.token = null;
        expect(((await requirePermission('billing', 'view')) as any).error.status).toBe(401);
        state.token = await tokenFor('PHARMACIST', 5);
        expect(((await requirePermission('billing', 'view')) as any).error.status).toBe(403);
        expect('user' in (await requirePermission('pharmacy.dispensing', 'approve'))).toBe(true);
        state.token = await tokenFor('RECEPTIONIST', 8);
        expect('user' in (await requirePermission('billing', 'approve'))).toBe(true);
    });

    it('any one of several rules is enough, and a patient is let in only where patients are allowed', async () => {
        state.token = await tokenFor('DOCTOR', 2);
        expect('user' in (await requireAccess('PATIENT', ['reception.appointments', 'view'], ['consultations', 'view']))).toBe(true);
        state.token = await tokenFor('PATIENT', 4);
        expect('user' in (await requireAccess('PATIENT', ['consultations', 'view']))).toBe(true);
        expect(((await requireAccess(['consultations', 'view'])) as any).error.status).toBe(403);
        expect(((await requirePermission('billing', 'view')) as any).error.status).toBe(403);
    });

    it('with nothing stored a staff member is refused everywhere', async () => {
        database([], false);
        state.token = await tokenFor('DOCTOR', 2);
        expect(((await requirePermission('consultations', 'view')) as any).error.status).toBe(403);
        expect(((await requirePermission('my.work', 'view')) as any).error.status).toBe(403);
    });

    it('changed permissions apply on the very next request', async () => {
        state.token = await tokenFor('PHARMACIST', 5);
        expect(((await requirePermission('billing', 'view')) as any).error?.status).toBe(403);
        database([row({ resource: 'billing', can_view: 1 })]);
        expect('user' in (await requirePermission('billing', 'view'))).toBe(true);
    });
});
