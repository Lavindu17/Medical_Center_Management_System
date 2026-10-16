import { describe, it, expect, beforeEach, vi } from 'vitest';
import { query } from '@/lib/db';
import { state } from './helpers/state';
import { tokenFor } from './helpers/auth';
import { LEVELS, RESOURCE_KEYS, RESOURCES, RESOURCE_LIST, levelsOf, MODULES } from '@/lib/access/registry';
import { ROLE_DEFAULTS, STAFF_ROLES, mergeGrants, normalise } from '@/lib/access/defaults';
import { allows, grantsFor } from '@/lib/access/resolve';
import { requireAccess, requirePermission, requireStaffMember } from '@/lib/api-auth';

describe('the catalogue', () => {
    it('lists each screen once, in a known module, with at least a view level and a description of every level it offers', () => {
        expect(new Set(RESOURCE_KEYS).size).toBe(RESOURCE_KEYS.length);
        for (const r of RESOURCE_LIST) {
            expect(MODULES, r.key).toContain(r.module);
            expect(levelsOf(r.key).length, r.key).toBeGreaterThan(0);
            expect(r.levels.view, `${r.key} must offer view`).toBeTruthy();
            for (const l of levelsOf(r.key)) expect(r.levels[l]!.length, `${r.key}.${l}`).toBeGreaterThan(2);
            expect(r.description.length).toBeGreaterThan(5);
        }
    });
    it('only grants levels a screen offers, and never offers a level outside the four', () => {
        for (const key of RESOURCE_KEYS) for (const l of levelsOf(key)) expect(LEVELS).toContain(l);
        for (const role of STAFF_ROLES) for (const [key, grant] of Object.entries(ROLE_DEFAULTS[role])) {
            for (const l of Object.keys(grant!)) expect(levelsOf(key as any), `${role} ${key}.${l}`).toContain(l);
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

describe('what each role starts with (the old fixed rules)', () => {
    const can = async (role: string, resource: any, level: any) => allows(await grantsFor({ id: 1, role }), resource, level);

    it('the front desk books, checks in, registers and takes payments, and nothing else', async () => {
        for (const [r, l] of [['reception.appointments', 'add'], ['reception.appointments', 'change'], ['reception.patients', 'add'], ['billing', 'approve'], ['billing', 'view']] as const) {
            expect(await can('RECEPTIONIST', r, l), `${r}.${l}`).toBe(true);
        }
        for (const [r, l] of [['pharmacy.dispensing', 'view'], ['hr.leave', 'approve'], ['admin.revenue', 'view'], ['consultations', 'view']] as const) {
            expect(await can('RECEPTIONIST', r, l), `${r}.${l}`).toBe(false);
        }
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
    it('the administrator runs the clinic (administration, HR, access control, the front desk) but does not do clinical work', async () => {
        for (const key of RESOURCE_KEYS.filter((k) => k.startsWith('admin.') || k.startsWith('hr.') || k === 'access.config')) {
            for (const l of levelsOf(key)) expect(await can('ADMIN', key, l), `${key}.${l}`).toBe(true);
        }
        expect(await can('ADMIN', 'reception.appointments', 'change')).toBe(true);
        expect(await can('ADMIN', 'pharmacy.dispensing', 'approve')).toBe(false);
        expect(await can('ADMIN', 'consultations', 'view')).toBe(false);
        expect(await can('ADMIN', 'billing', 'approve')).toBe(false);
    });
    it('patients and unknown roles have nothing in the staff catalogue', async () => {
        expect(await grantsFor({ id: 1, role: 'PATIENT' })).toEqual({});
        expect(await grantsFor({ id: 1, role: 'MYSTERY' })).toEqual({});
    });
});

describe('stored profiles', () => {
    const row = (over: Record<string, unknown>) => ({ profile_id: 1, system_role: null, resource: null, can_view: 0, can_add: 0, can_change: 0, can_approve: 0, ...over });
    beforeEach(() => { vi.mocked(query).mockReset().mockResolvedValue([]); });

    it('a profile given to a person adds to the role\'s defaults (a pharmacist who also handles billing)', async () => {
        vi.mocked(query).mockResolvedValueOnce([row({ profile_id: 9, resource: 'billing', can_view: 1, can_approve: 1 })] as any);
        const g = await grantsFor({ id: 5, role: 'PHARMACIST' });
        expect(allows(g, 'billing', 'approve')).toBe(true);
        expect(allows(g, 'billing', 'view')).toBe(true);
        expect(allows(g, 'pharmacy.dispensing', 'approve')).toBe(true);       // still has the role's own
    });

    it('a stored copy of the role\'s profile replaces the defaults for the resources it lists, so permissions can be taken away', async () => {
        vi.mocked(query).mockResolvedValueOnce([
            row({ profile_id: 2, system_role: 'PHARMACIST', resource: 'pharmacy.inventory', can_view: 1 }),                 // view only now
            row({ profile_id: 2, system_role: 'PHARMACIST', resource: 'pharmacy.dispensing' }),                             // nothing now
        ] as any);
        const g = await grantsFor({ id: 5, role: 'PHARMACIST' });
        expect(allows(g, 'pharmacy.inventory', 'view')).toBe(true);
        expect(allows(g, 'pharmacy.inventory', 'change')).toBe(false);
        expect(allows(g, 'pharmacy.dispensing', 'view')).toBe(false);
        expect(allows(g, 'pharmacy.alerts', 'view')).toBe(true);              // not listed: keeps the default
    });

    it('a ticked add or approve brings view with it', async () => {
        vi.mocked(query).mockResolvedValueOnce([row({ profile_id: 9, resource: 'hr.leave', can_approve: 1 })] as any);
        expect(allows(await grantsFor({ id: 5, role: 'DOCTOR' }), 'hr.leave', 'view')).toBe(true);
    });

    it('an administrator can always change access, even if a stored profile tries to remove it (no lock-out)', async () => {
        vi.mocked(query).mockResolvedValue([row({ profile_id: 2, system_role: 'ADMIN', resource: 'access.config' }), row({ profile_id: 2, system_role: 'ADMIN', resource: 'admin.revenue' })] as any);
        const g = await grantsFor({ id: 1, role: 'ADMIN' });
        expect(allows(g, 'access.config', 'change')).toBe(true);
        expect(allows(g, 'admin.revenue', 'view')).toBe(false);          // everything else can be taken away
    });

    it('unknown resources in the database are ignored', async () => {
        vi.mocked(query).mockResolvedValueOnce([row({ profile_id: 9, resource: 'no.such.screen', can_view: 1 })] as any);
        expect(await grantsFor({ id: 5, role: 'PATIENT' })).toEqual({});
    });

    it('before the tables exist the built-in defaults apply', async () => {
        vi.mocked(query).mockRejectedValueOnce(Object.assign(new Error('no table'), { errno: 1146 }));
        expect(allows(await grantsFor({ id: 5, role: 'PHARMACIST' }), 'pharmacy.dispensing', 'approve')).toBe(true);
    });

    it('any other database error is not swallowed (never fail open)', async () => {
        vi.mocked(query).mockRejectedValueOnce(Object.assign(new Error('boom'), { errno: 1205 }));
        await expect(grantsFor({ id: 5, role: 'PHARMACIST' })).rejects.toThrow('boom');
    });
});

describe('guards', () => {
    beforeEach(() => { vi.mocked(query).mockReset().mockResolvedValue([]); });

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

    it('staff pages: anyone but a patient', async () => {
        state.token = await tokenFor('LAB_ASSISTANT', 7);
        expect('user' in (await requireStaffMember())).toBe(true);
        state.token = await tokenFor('PATIENT', 4);
        expect(((await requireStaffMember()) as any).error.status).toBe(403);
    });

    it('changed permissions apply on the very next request', async () => {
        state.token = await tokenFor('PHARMACIST', 5);
        expect(((await requirePermission('billing', 'view')) as any).error?.status).toBe(403);
        vi.mocked(query).mockResolvedValueOnce([{ profile_id: 9, system_role: null, resource: 'billing', can_view: 1, can_add: 0, can_change: 0, can_approve: 0 }] as any);
        expect('user' in (await requirePermission('billing', 'view'))).toBe(true);
    });
});
