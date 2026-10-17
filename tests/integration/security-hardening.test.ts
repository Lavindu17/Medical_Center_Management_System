import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { pool, query } from '@/lib/db';
import { ALICE, BOB, DOCTOR, PHARMACIST, as, ctx, post, rows, one, isoDate, makeAppointment, consult } from './helpers';
import { requestHeaders, state } from '../helpers/state';
import { passwordProblem } from '@/lib/password';

// Findings from the security review, as tests: weak passwords, abuse of sign-up and sign-in, taking over an administrator through
// the user list, doctors reading patients who are not theirs, stacked SQL statements, and the demo-password warning.
afterAll(async () => { await pool.end(); });

const ADMIN = 1;
const uniq = () => `${Date.now()}${Math.floor(Math.random() * 100000)}`;
const call = async (route: string, body: unknown) => (await import(`@/app/api/auth/${route}/route`)).POST(post('/x', body));
beforeEach(() => { for (const k of Object.keys(requestHeaders)) delete requestHeaders[k]; state.token = null; });

const register = (over: Record<string, unknown> = {}) =>
    call('register', { firstName: 'Sec', lastName: 'Test', email: `sec.${uniq()}@security.test`, password: 'Correct-Horse-1', dob: '1990-01-01', gender: 'FEMALE', ...over });

describe('password rules', () => {
    it.each([
        ['too short', 'Ab1!xyz'],
        ['a common password', 'password123'],
        ['a common password with different capitals', 'PassWord123'],
        ['a common password with a number swapped in', 'Passw0rd'],
        ['one character repeated', 'aaaaaaaaaa'],
        ['more than 72 bytes', 'a1'.repeat(40)],
    ])('refuses %s', (_label, password) => expect(passwordProblem(password)).not.toBeNull());

    it('refuses a password that contains the person\'s email name, accepts a strong one', () => {
        expect(passwordProblem('janedoe-2026!', ['janedoe@clinic.test'])).not.toBeNull();
        expect(passwordProblem('Correct-Horse-1', ['janedoe@clinic.test'])).toBeNull();
    });

    it('registration, reset, change-password and admin-created accounts all enforce it', async () => {
        for (const password of ['password123', '12345678', 'short1']) {
            expect((await register({ password })).status, password).toBe(400);
        }
        expect((await register({ email: 'katherine.smith@security.test', password: 'katherine-2026' })).status).toBe(400);
        expect((await register()).status).toBe(201);

        await as('ADMIN', ADMIN);
        const users = await import('@/app/api/users/route');
        expect((await users.POST(post('/x', { name: 'Weak Staff', email: `weak.${uniq()}@security.test`, password: 'password123', role: 'PHARMACIST' }))).status).toBe(400);

        const email = `reset.${uniq()}@security.test`;
        await register({ email });
        expect((await call('reset', { email, code: 'ABC123', newPassword: 'password123' })).status).toBe(400);
        await as('PHARMACIST', PHARMACIST);
        expect((await call('change-password', { currentPassword: 'whatever-1', newPassword: 'qwerty123' })).status).toBe(400);
    });
});

describe('sign-up and sign-in abuse', () => {
    it('one caller cannot register more than ten accounts an hour (each one sends an email)', async () => {
        requestHeaders['x-forwarded-for'] = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
        const statuses: number[] = [];
        for (let i = 0; i < 12; i++) statuses.push((await register()).status);
        expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);
        expect(statuses.slice(10)).toEqual([429, 429]);
    });

    it('the same address is limited too, even from different callers', async () => {
        const email = `same.${uniq()}@security.test`;
        const statuses: number[] = [];
        for (let i = 0; i < 7; i++) { requestHeaders['x-forwarded-for'] = `198.51.100.${i + 1}`; statuses.push((await register({ email })).status); }
        expect(statuses.at(-1)).toBe(429);
    });

    it('one caller trying many different accounts is slowed down (password spraying)', async () => {
        requestHeaders['x-forwarded-for'] = `192.0.2.${Math.floor(Math.random() * 200) + 1}`;
        let blockedAt = 0;
        for (let i = 1; i <= 105; i++) {
            const res = await call('login', { email: `nobody.${uniq()}.${i}@security.test`, password: 'Wrong-guess-1' });
            if (res.status === 429) { blockedAt = i; break; }
        }
        expect(blockedAt).toBe(101);
    }, 60000);

    it('without a readable address the per-account limit still applies', async () => {
        const email = `lock.${uniq()}@security.test`;
        for (let i = 0; i < 10; i++) await call('login', { email, password: 'Wrong-guess-1' });
        expect((await call('login', { email, password: 'Wrong-guess-1' })).status).toBe(429);
    });
});

describe('managing accounts is not a way to become an administrator', () => {
    const users = '@/app/api/users/route';
    const someone = async (role = 'STAFF', name = 'Account manager') => {
        const r: any = await query(`INSERT INTO users (email, password_hash, name, role, is_verified) VALUES (?, 'x', ?, ?, 1)`, [`mgr.${uniq()}@security.test`, name, role]);
        return r.insertId as number;
    };
    const give = async (userId: number, grants: Record<string, string[]>) => {
        const p: any = await query(`INSERT INTO access_profiles (name) VALUES (?)`, [`Sec ${uniq()}`]);
        for (const [resource, levels] of Object.entries(grants)) {
            await query(`INSERT INTO access_grants (profile_id, resource, can_view, can_add, can_change, can_approve) VALUES (?, ?, ?, ?, ?, ?)`,
                [p.insertId, resource, +levels.includes('view'), +levels.includes('add'), +levels.includes('change'), +levels.includes('approve')]);
        }
        await query(`INSERT INTO user_access_profiles (user_id, profile_id) VALUES (?, ?)`, [userId, p.insertId]);
    };

    it('someone who can add and change users cannot create an administrator, make themselves one, or touch an existing one', async () => {
        const manager = await someone();
        await give(manager, { 'admin.users': ['view', 'add', 'change'] });
        const newAdmin = await someone('ADMIN', 'Another admin');
        await as('STAFF', manager);
        const route = await import(users);

        const create = await route.POST(post('/x', { name: 'Sneaky Admin', email: `sneaky.${uniq()}@security.test`, password: 'Correct-Horse-1', role: 'ADMIN' }));
        expect(create.status).toBe(403);
        expect((await rows(`SELECT 1 FROM users WHERE name = 'Sneaky Admin'`))).toHaveLength(0);

        const promote = await route.PUT(post('/x', { id: manager, name: 'Account manager', email: `mgr.${uniq()}@security.test`, role: 'ADMIN' }, 'PUT'));
        expect(promote.status).toBe(403);
        expect((await one(`SELECT role FROM users WHERE id = ?`, [manager])).role).toBe('STAFF');

        // Changing an administrator's email and then resetting their password would be a takeover
        const takeover = await route.PUT(post('/x', { id: newAdmin, name: 'Another admin', email: `attacker.${uniq()}@security.test`, role: 'ADMIN' }, 'PUT'));
        expect(takeover.status).toBe(403);
        expect((await route.DELETE(new Request(`http://x/api/users?id=${newAdmin}`, { method: 'DELETE' }))).status).toBe(403);
        expect(await rows(`SELECT 1 FROM users WHERE id = ?`, [newAdmin])).toHaveLength(1);
    });

    it('the same person can still manage ordinary accounts', async () => {
        const manager = await someone();
        await give(manager, { 'admin.users': ['view', 'add', 'change'] });
        const target = await someone('PHARMACIST', 'Ordinary pharmacist');
        await as('STAFF', manager);
        const route = await import(users);
        const email = `ordinary.${uniq()}@security.test`;
        expect((await route.PUT(post('/x', { id: target, name: 'Renamed Pharmacist', email, role: 'PHARMACIST' }, 'PUT'))).status).toBe(200);
        expect((await route.POST(post('/x', { name: 'New Receptionist', email: `new.${uniq()}@security.test`, password: 'Correct-Horse-1', role: 'RECEPTIONIST' }))).status).toBe(201);
    });

    it('anyone who holds access control counts as an administrator and is protected the same way', async () => {
        const manager = await someone();
        await give(manager, { 'admin.users': ['view', 'add', 'change'] });
        const delegate = await someone('STAFF', 'Access delegate');
        await give(delegate, { 'access.config': ['view', 'change'] });
        await as('STAFF', manager);
        const route = await import(users);
        expect((await route.PUT(post('/x', { id: delegate, name: 'Access delegate', email: `d.${uniq()}@security.test`, role: 'STAFF' }, 'PUT'))).status).toBe(403);
        expect((await route.DELETE(new Request(`http://x/api/users?id=${delegate}`, { method: 'DELETE' }))).status).toBe(403);
    });

    it('administrators can still do all of it', async () => {
        await as('ADMIN', ADMIN);
        const route = await import(users);
        const res = await route.POST(post('/x', { name: 'Legit Admin', email: `legit.${uniq()}@security.test`, password: 'Correct-Horse-1', role: 'ADMIN' }));
        expect(res.status).toBe(201);
        const created = await one(`SELECT id FROM users WHERE name = 'Legit Admin' ORDER BY id DESC LIMIT 1`);
        expect((await route.DELETE(new Request(`http://x/api/users?id=${created.id}`, { method: 'DELETE' }))).status).toBe(200);
    });
});

describe('doctors reach only their own patients', () => {
    const list = async (qs = '') => (await import('@/app/api/doctor/patients/route')).GET(new Request(`http://x/api/doctor/patients${qs}`));
    const chart = async (id: number) => (await import('@/app/api/doctor/patients/[id]/route')).GET(new Request('http://x'), ctx(id));

    it('the directory, the search and the chart are limited to patients with an appointment with that doctor', async () => {
        const mine = await makeAppointment(ALICE);                                         // Dr. Smith (2) with Alice
        const stranger: any = await query(`INSERT INTO users (email, password_hash, name, role, is_verified) VALUES (?, 'x', 'Zed Stranger', 'PATIENT', 1)`, [`stranger.${uniq()}@security.test`]);
        await query(`INSERT INTO patients (user_id, date_of_birth, gender, address) VALUES (?, '1990-01-01', 'MALE', 'x')`, [stranger.insertId]);
        const theirs = (await query<any>(`INSERT INTO appointments (patient_id, doctor_id, date, time_slot, queue_number, status) VALUES (?, 3, ?, '10:00', 1, 'PENDING')`, [stranger.insertId, isoDate(170)])).insertId as number;
        await as('DOCTOR', DOCTOR);
        const recent = (await (await list()).json()).map((p: any) => p.id);
        expect(recent).toContain(ALICE);
        expect(recent).not.toContain(stranger.insertId);
        expect((await (await list('?search=%25')).json()).map((p: any) => p.id)).not.toContain(stranger.insertId);     // a wildcard dumps nothing extra
        expect((await (await list('?search=Stranger')).json())).toEqual([]);
        expect((await chart(ALICE)).status).toBe(200);
        expect((await chart(stranger.insertId)).status).toBe(404);
        await query(`DELETE FROM appointments WHERE id IN (?, ?)`, [mine, theirs]);
    });

    it('another doctor\'s private working notes are not shown in a patient\'s history', async () => {
        const mine = await makeAppointment(ALICE);
        await consult(mine, { status: 'COMPLETED', notes: 'my own note' });
        const other = (await query<any>(`INSERT INTO appointments (patient_id, doctor_id, date, time_slot, queue_number, status, notes) VALUES (?, 3, ?, '11:00', 1, 'COMPLETED', 'another doctors private note')`, [ALICE, isoDate(-5)])).insertId as number;
        await as('DOCTOR', DOCTOR);
        const body = JSON.stringify(await (await chart(ALICE)).json());
        expect(body).toContain('my own note');
        expect(body).not.toContain('another doctors private note');
        await query(`DELETE FROM appointments WHERE id = ?`, [other]);
    });
});

describe('the database connection', () => {
    it('does not run stacked statements (an injection could not append a second one)', async () => {
        await expect(query('SELECT 1; SELECT 2')).rejects.toBeTruthy();
        await expect(pool.query('SELECT 1; DROP TABLE security_probe_does_not_exist')).rejects.toBeTruthy();
    });
});

describe('the demo password warning', () => {
    it('counts accounts that still hold the seeded demo password hash, and goes when they are changed', async () => {
        const dashboard = async () => { await as('ADMIN', ADMIN); return (await (await import('@/app/api/admin/dashboard/route')).GET()).json(); };
        const before = (await dashboard()).health.demoPasswordAccounts;
        expect(before).toBeGreaterThan(0);                                             // the seeded demo users
        const demoHash = (await one(`SELECT password_hash h FROM users WHERE id = ?`, [ADMIN])).h;
        const r: any = await query(`INSERT INTO users (email, password_hash, name, role, is_verified) VALUES (?, ?, 'Demo pw', 'STAFF', 1)`, [`demo.${uniq()}@security.test`, demoHash]);
        expect((await dashboard()).health.demoPasswordAccounts).toBe(before + 1);
        await query(`UPDATE users SET password_hash = 'x' WHERE id = ?`, [r.insertId]);
        expect((await dashboard()).health.demoPasswordAccounts).toBe(before);
    });
});

describe('signing out', () => {
    it('ends the session for real: a copied token stops working, a new sign-in still works', async () => {
        const r: any = await query(`INSERT INTO users (email, password_hash, name, role, is_verified) VALUES (?, 'x', 'Signs Out', 'PHARMACIST', 1)`, [`out.${uniq()}@security.test`]);
        const { tokenFor } = await import('../helpers/auth');
        const now = Math.floor(Date.now() / 1000);
        const stolen = await tokenFor('PHARMACIST', r.insertId, undefined, now - 30);
        const { AuthService } = await import('@/services/auth.service');
        expect(await AuthService.verifyToken(stolen)).toBeTruthy();

        state.token = stolen;
        const res = await (await import('@/app/api/auth/logout/route')).POST();
        expect(res.status).toBe(200);

        expect(await AuthService.verifyToken(stolen)).toBeNull();
        expect(await AuthService.verifyToken(await tokenFor('PHARMACIST', r.insertId, undefined, now + 5))).toBeTruthy();
    });
});

describe('handing out access control is for administrators only', () => {
    const grantsOf = (extra: Record<string, any> = {}) => ({ 'admin.users': { view: true }, ...extra });
    it('a delegate who can configure access cannot give access control to anyone, or touch the administrator role', async () => {
        const mk = async (name: string): Promise<number> => ((await query(`INSERT INTO users (email, password_hash, name, role, is_verified) VALUES (?, 'x', ?, 'STAFF', 1)`, [`dg.${uniq()}@security.test`, name])) as any).insertId;
        const delegate = await mk('Delegate'); const friend = await mk('Friend');
        const p: any = await query(`INSERT INTO access_profiles (name) VALUES (?)`, [`Config ${uniq()}`]);
        await query(`INSERT INTO access_grants (profile_id, resource, can_view, can_add, can_change, can_approve) VALUES (?, 'access.config', 1, 0, 1, 0)`, [p.insertId]);
        await query(`INSERT INTO user_access_profiles (user_id, profile_id) VALUES (?, ?)`, [delegate, p.insertId]);

        await as('STAFF', delegate);
        const profiles = await import('@/app/api/admin/access/profiles/route');
        const user = await import('@/app/api/admin/access/users/[id]/route');
        const role = await import('@/app/api/admin/access/roles/[role]/route');
        const rolectx = (r: string) => ({ params: Promise.resolve({ role: r }) });

        // an ordinary profile is fine
        expect((await profiles.POST(post('/x', { name: `Plain ${uniq()}`, grants: grantsOf() }))).status).toBe(201);
        // one that includes access control is not
        expect((await profiles.POST(post('/x', { name: `Sneaky ${uniq()}`, grants: grantsOf({ 'access.config': { view: true, change: true } }) }))).status).toBe(403);
        // nor is giving a friend the profile that holds it, or ticking it for them directly
        expect((await user.PUT(post('/x', { profileIds: [p.insertId], personal: {} }, 'PUT'), ctx(friend))).status).toBe(403);
        expect((await user.PUT(post('/x', { profileIds: [], personal: { 'access.config': { view: true, change: true } } }, 'PUT'), ctx(friend))).status).toBe(403);
        expect((await user.PUT(post('/x', { profileIds: [], personal: { 'admin.users': { view: true } } }, 'PUT'), ctx(friend))).status).toBe(200);
        // and the administrator role is off limits
        expect((await role.PUT(post('/x', { grants: grantsOf() }, 'PUT'), rolectx('ADMIN'))).status).toBe(403);

        // an administrator can do all of it
        await as('ADMIN', ADMIN);
        expect((await user.PUT(post('/x', { profileIds: [p.insertId], personal: {} }, 'PUT'), ctx(friend))).status).toBe(200);
    });
});
