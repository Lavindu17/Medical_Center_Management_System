import { describe, it, expect, afterAll } from 'vitest';
import { pool, query } from '@/lib/db';
import { ALICE, DOCTOR, PHARMACIST, RECEPTIONIST, as, post, rows, one } from './helpers';

// The configuration window's API: searching staff, giving people profiles and their own ticks, editing a role's starting
// profile, creating profiles, and seeing who can do what on a screen.
afterAll(async () => { await pool.end(); });

const ADMIN = 1;
const uniq = () => `T${Date.now()}${Math.floor(Math.random() * 10000)}`;

const call = async (mod: string, method: string, opts: { body?: unknown; id?: string | number; url?: string } = {}, as_: [any, number] = ['ADMIN', ADMIN]) => {
    await as(as_[0], as_[1]);
    const handler = (await import(mod))[method];
    const req = opts.body === undefined ? new Request(opts.url ?? 'http://x', { method }) : post('/x', opts.body, method);
    const name = mod.includes('/roles/') ? 'role' : mod.includes('/screens/') ? 'key' : 'id';
    return handler(req, { params: Promise.resolve({ [name]: String(opts.id ?? 1) }) });
};
const users = '@/app/api/admin/access/users/route';
const user = '@/app/api/admin/access/users/[id]/route';
const profiles = '@/app/api/admin/access/profiles/route';
const profile = '@/app/api/admin/access/profiles/[id]/route';
const roles = '@/app/api/admin/access/roles/[role]/route';
const screens = '@/app/api/admin/access/screens/[key]/route';

const billingList = async () => { await as('PHARMACIST', PHARMACIST); return (await (await import('@/app/api/receptionist/billing/route')).GET(new Request('http://x'))).status; };

describe('who may configure access', () => {
    it('only holders of the access-control permission', async () => {
        for (const [role, id] of [['DOCTOR', DOCTOR], ['PHARMACIST', PHARMACIST], ['RECEPTIONIST', RECEPTIONIST], ['PATIENT', ALICE]] as const) {
            expect((await call(users, 'GET', {}, [role, id])).status, role).toBe(403);
            expect((await call(profiles, 'GET', {}, [role, id])).status, role).toBe(403);
            expect((await call(profiles, 'POST', { body: { name: 'x', grants: {} } }, [role, id])).status, role).toBe(403);
            expect((await call(user, 'PUT', { body: { profileIds: [], personal: {} }, id: PHARMACIST }, [role, id])).status, role).toBe(403);
            expect((await call(roles, 'PUT', { body: { grants: {} }, id: 'PHARMACIST' }, [role, id])).status, role).toBe(403);
            expect((await call(screens, 'GET', { id: 'billing' }, [role, id])).status, role).toBe(403);
        }
    });

    it('a person can be given the permission to configure access', async () => {
        const p: any = await query(`INSERT INTO access_profiles (name) VALUES (?)`, [uniq()]);
        await query(`INSERT INTO access_grants (profile_id, resource, can_view) VALUES (?, 'access.config', 1)`, [p.insertId]);
        await query(`INSERT INTO user_access_profiles (user_id, profile_id) VALUES (?, ?)`, [RECEPTIONIST, p.insertId]);
        expect((await call(users, 'GET', {}, ['RECEPTIONIST', RECEPTIONIST])).status).toBe(200);                       // view
        expect((await call(profiles, 'POST', { body: { name: uniq(), grants: {} } }, ['RECEPTIONIST', RECEPTIONIST])).status).toBe(403);   // not change
        await query(`DELETE FROM access_profiles WHERE id = ?`, [p.insertId]);
    });
});

describe('finding people', () => {
    it('lists staff, never patients, and filters by name or email', async () => {
        const all = await (await call(users, 'GET')).json();
        expect(all.length).toBeGreaterThan(3);
        expect(all.every((u: any) => u.role !== 'PATIENT')).toBe(true);
        const found = await (await call(users, 'GET', { url: 'http://x?q=sarah' })).json();
        expect(found.some((u: any) => /sarah/i.test(u.name))).toBe(true);
        expect(found.length).toBeLessThan(all.length);
        expect(await (await call(users, 'GET', { url: 'http://x?q=%25' })).json()).toEqual([]);      // a wildcard is searched for literally
    });

    it('the detail of a person shows their role\'s starting access, profiles, own ticks and the total', async () => {
        const body = await (await call(user, 'GET', { id: PHARMACIST })).json();
        expect(body.user.role).toBe('PHARMACIST');
        expect(body.role['pharmacy.dispensing']).toMatchObject({ view: true, approve: true });
        expect(body.assigned).toEqual([]);
        expect(body.personal).toEqual({});
        expect(body.effective['pharmacy.dispensing'].approve).toBe(true);
        expect(body.effective.billing).toBeUndefined();
    });

    it('patients cannot be configured, and bad or unknown ids are refused', async () => {
        expect((await call(user, 'GET', { id: ALICE })).status).toBe(400);
        expect((await call(user, 'GET', { id: 999999 })).status).toBe(404);
        expect((await call(user, 'GET', { id: 'abc' })).status).toBe(400);
        expect((await call(user, 'PUT', { body: { profileIds: [], personal: {} }, id: ALICE })).status).toBe(400);
    });
});

describe('profiles', () => {
    it('are created, listed with their ticks and holders, edited and deleted', async () => {
        const name = uniq();
        const created = await call(profiles, 'POST', { body: { name, description: 'Cashier duties', grants: { billing: { approve: true } } } });
        expect(created.status).toBe(201);
        const { id } = await created.json();
        let list = await (await call(profiles, 'GET')).json();
        let mine = list.custom.find((p: any) => p.id === id);
        expect(mine).toMatchObject({ name, description: 'Cashier duties', people: 0 });
        expect(mine.grants.billing).toEqual({ view: true, approve: true });                  // approve brings view
        expect((await call(profile, 'PUT', { body: { name: `${name}b`, description: null, grants: { billing: { view: true } } }, id })).status).toBe(200);
        list = await (await call(profiles, 'GET')).json();
        mine = list.custom.find((p: any) => p.id === id);
        expect(mine.name).toBe(`${name}b`);
        expect(mine.grants.billing).toEqual({ view: true });
        expect((await call(profile, 'DELETE', { id })).status).toBe(200);
        expect((await call(profile, 'DELETE', { id })).status).toBe(404);
    });

    it.each([
        ['a name that is too short', { name: 'x', grants: {} }],
        ['a screen that does not exist', { name: 'Fine name', grants: { 'no.such': { view: true } } }],
        ['a name that is too long', { name: 'x'.repeat(81), grants: {} }],
        ['ticks that are not true or false', { name: 'Fine name', grants: { billing: { view: 'yes' } } }],
    ])('rejects %s', async (_l, body) => {
        expect((await call(profiles, 'POST', { body })).status).toBe(400);
    });

    it('two profiles cannot share a name', async () => {
        const name = uniq();
        const first = await (await call(profiles, 'POST', { body: { name, grants: {} } })).json();
        expect((await call(profiles, 'POST', { body: { name, grants: {} } })).status).toBe(409);
        await call(profile, 'DELETE', { id: first.id });
    });

    it('levels a screen does not offer are dropped', async () => {
        const { id } = await (await call(profiles, 'POST', { body: { name: uniq(), grants: { 'pharmacy.alerts': { view: true, approve: true, add: true } } } })).json();
        const list = await (await call(profiles, 'GET')).json();
        expect(list.custom.find((p: any) => p.id === id).grants['pharmacy.alerts']).toEqual({ view: true });
        await call(profile, 'DELETE', { id });
    });

    it('role profiles and personal profiles are not edited as ordinary profiles', async () => {
        const r: any = await query(`INSERT INTO access_profiles (name, system_role) VALUES (?, 'DOCTOR')`, [uniq()]);
        expect((await call(profile, 'PUT', { body: { name: 'Renamed', grants: {} }, id: r.insertId })).status).toBe(404);
        expect((await call(profile, 'DELETE', { id: r.insertId })).status).toBe(404);
        await query(`DELETE FROM access_profiles WHERE id = ?`, [r.insertId]);
    });
});

describe('giving a person access', () => {
    it('a profile plus the person\'s own ticks: effective at once, listed, and removable', async () => {
        const { id } = await (await call(profiles, 'POST', { body: { name: uniq(), grants: { billing: { view: true } } } })).json();
        expect(await billingList()).toBe(403);
        const saved = await call(user, 'PUT', { id: PHARMACIST, body: { profileIds: [id], personal: { 'hr.leave': { approve: true } } } });
        expect(saved.status).toBe(200);
        expect(await billingList()).toBe(200);
        const body = await (await call(user, 'GET', { id: PHARMACIST })).json();
        expect(body.assigned.map((p: any) => p.id)).toEqual([id]);
        expect(body.personal['hr.leave']).toEqual({ view: true, approve: true });
        expect(body.effective.billing.view).toBe(true);
        expect(body.effective['hr.leave'].approve).toBe(true);
        const found = await (await call(users, 'GET', { url: 'http://x?q=sarah' })).json();
        expect(found.find((u: any) => u.id === PHARMACIST).profiles.length).toBe(1);

        // Clearing everything removes the person's own profile too
        expect((await call(user, 'PUT', { id: PHARMACIST, body: { profileIds: [], personal: {} } })).status).toBe(200);
        expect(await billingList()).toBe(403);
        expect(await rows(`SELECT 1 FROM access_profiles WHERE owner_user_id = ?`, [PHARMACIST])).toHaveLength(0);
        await call(profile, 'DELETE', { id });
    });

    it('refuses a profile that does not exist, and changes nothing', async () => {
        const res = await call(user, 'PUT', { id: PHARMACIST, body: { profileIds: [999999], personal: { billing: { view: true } } } });
        expect(res.status).toBe(400);
        expect(await billingList()).toBe(403);
    });

    it('warns about risky combinations without blocking them', async () => {
        await call(user, 'PUT', { id: PHARMACIST, body: { profileIds: [], personal: { 'pharmacy.inventory': { change: true }, 'pharmacy.dispensing': { approve: true } } } });
        const body = await (await call(user, 'GET', { id: PHARMACIST })).json();
        expect(body.warnings.join(' ')).toMatch(/dispense medicines and also edit stock/i);
        await call(user, 'PUT', { id: PHARMACIST, body: { profileIds: [], personal: {} } });
    });

    it('the change is written to the audit trail, naming the person and what changed', async () => {
        await call(user, 'PUT', { id: PHARMACIST, body: { profileIds: [], personal: { billing: { approve: true } } } });
        const entry = await one(`SELECT details FROM audit_log WHERE entity_type = 'ACCESS' AND entity_id = ? AND actor_id = ? ORDER BY id DESC LIMIT 1`, [String(PHARMACIST), ADMIN]);
        expect(String(entry.details)).toContain('billing');
        expect(String(entry.details)).toContain('approve');
        await call(user, 'PUT', { id: PHARMACIST, body: { profileIds: [], personal: {} } });
    });
});

describe('editing a role at this site', () => {
    it('removes a permission from the whole role, and reset puts the built-in defaults back', async () => {
        const dispense = async () => { await as('PHARMACIST', PHARMACIST); return (await (await import('@/app/api/pharmacist/prescriptions/route')).GET(new Request('http://x'))).status; };
        expect(await dispense()).toBe(200);
        const list = await (await call(profiles, 'GET')).json();
        const grants = { ...list.roles.find((r: any) => r.role === 'PHARMACIST').grants, 'pharmacy.dispensing': {} };
        expect((await call(roles, 'PUT', { id: 'PHARMACIST', body: { grants } })).status).toBe(200);
        expect(await dispense()).toBe(403);
        expect((await (await call(profiles, 'GET')).json()).roles.find((r: any) => r.role === 'PHARMACIST').customised).toBe(true);
        expect((await call(roles, 'DELETE', { id: 'PHARMACIST' })).status).toBe(200);
        expect(await dispense()).toBe(200);
        expect((await (await call(profiles, 'GET')).json()).roles.find((r: any) => r.role === 'PHARMACIST').customised).toBe(false);
    });

    it('the administrator role always keeps access control, however it is edited', async () => {
        expect((await call(roles, 'PUT', { id: 'ADMIN', body: { grants: {} } })).status).toBe(200);
        expect((await call(users, 'GET')).status).toBe(200);
        const list = await (await call(profiles, 'GET')).json();
        expect(list.roles.find((r: any) => r.role === 'ADMIN').grants['access.config']).toEqual({ view: true, change: true });
        await call(roles, 'DELETE', { id: 'ADMIN' });
    });

    it('unknown roles, patients included, are refused', async () => {
        expect((await call(roles, 'PUT', { id: 'PATIENT', body: { grants: {} } })).status).toBe(404);
        expect((await call(roles, 'PUT', { id: 'WIZARD', body: { grants: {} } })).status).toBe(404);
        expect((await call(roles, 'DELETE', { id: 'PATIENT' })).status).toBe(404);
    });

    it('the profile list reports every staff role with the number of people', async () => {
        const list = await (await call(profiles, 'GET')).json();
        expect(list.ready).toBe(true);
        expect(list.roles.map((r: any) => r.role).sort()).toEqual(['ADMIN', 'DOCTOR', 'HR_MANAGER', 'LAB_ASSISTANT', 'PHARMACIST', 'RECEPTIONIST']);
        expect(list.roles.find((r: any) => r.role === 'PHARMACIST').people).toBeGreaterThan(0);
    });
});

describe('who has a screen', () => {
    it('lists the staff who can do something on it, with their levels', async () => {
        const body = await (await call(screens, 'GET', { id: 'pharmacy.dispensing' })).json();
        const sarah = body.people.find((p: any) => p.id === PHARMACIST);
        expect(sarah.levels).toEqual(['view', 'approve']);
        expect(body.people.every((p: any) => p.role !== 'PATIENT')).toBe(true);
        expect(body.people.some((p: any) => p.id === RECEPTIONIST)).toBe(false);
    });
    it('an unknown screen is a 404', async () => {
        expect((await call(screens, 'GET', { id: 'no.such' })).status).toBe(404);
    });
});
