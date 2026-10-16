import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { pool, query } from '@/lib/db';
import { ALICE, BOB, DOCTOR, PHARMACIST, RECEPTIONIST, as, ctx, post, rows, one, isoDate, makeAppointment, consult, addMedicine, setRoleTicks, restoreRole } from './helpers';
import { RESOURCE_KEYS } from '@/lib/access/registry';
import { ROLE_TEMPLATES, STAFF_ROLES } from '@/lib/access/defaults';
import { templateRows } from '@/lib/access/seed';

// The situations a real site runs into: people with unusual combinations of access, upgrades, people who leave, several
// administrators at once, and everything that has to follow permissions rather than job titles (notifications, scoping).
afterAll(async () => { await pool.end(); });

const ADMIN = 1;
const LAB = 7;
const DOCTOR_TWO = 3;
const uniq = () => `${Date.now()}${Math.floor(Math.random() * 100000)}`;

const created: number[] = [];
async function makeStaff(role = 'STAFF', name = 'Test Staff') {
    const r: any = await query(`INSERT INTO users (email, password_hash, name, role, is_verified) VALUES (?, 'x', ?, ?, 1)`, [`staff.${uniq()}@access.test`, name, role]);
    created.push(r.insertId);
    return r.insertId as number;
}
/** Gives a person a profile with these ticks, the way the access window does. */
async function give(userId: number, grants: Record<string, string[]>) {
    const p: any = await query(`INSERT INTO access_profiles (name) VALUES (?)`, [`Test ${uniq()}`]);
    for (const [resource, levels] of Object.entries(grants)) {
        await query(`INSERT INTO access_grants (profile_id, resource, can_view, can_add, can_change, can_approve) VALUES (?, ?, ?, ?, ?, ?)`,
            [p.insertId, resource, +levels.includes('view'), +levels.includes('add'), +levels.includes('change'), +levels.includes('approve')]);
    }
    await query(`INSERT INTO user_access_profiles (user_id, profile_id) VALUES (?, ?)`, [userId, p.insertId]);
    return p.insertId as number;
}
const maxNotification = async () => Number((await one(`SELECT COALESCE(MAX(id), 0) AS m FROM notifications`)).m);
const got = async (userId: number, type: string, since: number) =>
    (await rows(`SELECT id FROM notifications WHERE user_id = ? AND type = ? AND id > ?`, [userId, type, since])).length > 0;

describe('every stored role profile equals its starting profile', () => {
    it('the seed wrote exactly the starting ticks for every role and every screen', async () => {
        for (const role of STAFF_ROLES) {
            const stored = await rows(`SELECT g.resource, g.can_view, g.can_add, g.can_change, g.can_approve FROM access_profiles p JOIN access_grants g ON g.profile_id = p.id WHERE p.system_role = ?`, [role]);
            expect(stored.length, role).toBe(RESOURCE_KEYS.length);
            for (const t of templateRows(role)) {
                const row = stored.find((r: any) => r.resource === t.resource);
                expect([row.can_view, row.can_add, row.can_change, row.can_approve].map(Number), `${role} ${t.resource}`).toEqual([t.view, t.add, t.change, t.approve]);
            }
        }
    });
    it('"Other staff" starts with only their own work and account', () => {
        expect(Object.keys(ROLE_TEMPLATES.STAFF).sort()).toEqual(['my.account', 'my.work']);
    });
});

describe('notifications follow permissions, not job titles', () => {
    const prescribe = async () => {
        const med = await addMedicine(`Notif-${uniq()}`, [{ qty: 50, expiryDays: 100, sell: 2 }]);
        const appt = await makeAppointment(ALICE);
        return consult(appt, { status: 'ONGOING', prescription: [{ medicineId: med, dosage: '1', frequency: '1-0-0-0', duration: '3 days', quantity: 3 }] });
    };

    it('a person given dispensing through a profile is told about new prescriptions; a pharmacist whose dispensing was removed is not', async () => {
        const helper = await makeStaff('STAFF', 'Pharmacy helper');
        await give(helper, { 'pharmacy.dispensing': ['view'] });
        const mark = await maxNotification();
        expect((await prescribe()).status).toBe(200);
        expect(await got(helper, 'PRESCRIPTION_ISSUED', mark)).toBe(true);
        expect(await got(PHARMACIST, 'PRESCRIPTION_ISSUED', mark)).toBe(true);

        await setRoleTicks('PHARMACIST', 'pharmacy.dispensing', []);
        const mark2 = await maxNotification();
        await prescribe();
        expect(await got(PHARMACIST, 'PRESCRIPTION_ISSUED', mark2)).toBe(false);
        expect(await got(helper, 'PRESCRIPTION_ISSUED', mark2)).toBe(true);
        await restoreRole('PHARMACIST');
    });

    it('new lab requests go to everyone who can see lab requests', async () => {
        const clerk = await makeStaff('STAFF', 'Lab clerk');
        await give(clerk, { 'lab.requests': ['view'] });
        const mark = await maxNotification();
        await consult(await makeAppointment(ALICE), { status: 'ONGOING', labOrders: [{ testId: 1 }] });
        expect(await got(clerk, 'LAB_REQUESTED', mark)).toBe(true);
        expect(await got(LAB, 'LAB_REQUESTED', mark)).toBe(true);
        await setRoleTicks('LAB_ASSISTANT', 'lab.requests', []);
        const mark2 = await maxNotification();
        await consult(await makeAppointment(ALICE), { status: 'ONGOING', labOrders: [{ testId: 2 }] });
        expect(await got(LAB, 'LAB_REQUESTED', mark2)).toBe(false);
        await restoreRole('LAB_ASSISTANT');
    });

    it('a bill that is ready goes to whoever can see billing (a pharmacist with billing, not only the front desk)', async () => {
        const biller = await makeStaff('PHARMACIST', 'Pharmacist with billing');
        await give(biller, { billing: ['view'] });
        const mark = await maxNotification();
        await consult(await makeAppointment(ALICE), { status: 'COMPLETED' });
        expect(await got(biller, 'BILL_READY', mark)).toBe(true);
        expect(await got(RECEPTIONIST, 'BILL_READY', mark)).toBe(true);
    });

    it('leave requests go to people who can approve leave, and not to people who can only see it', async () => {
        const approver = await makeStaff('STAFF', 'Leave approver');
        const viewer = await makeStaff('STAFF', 'Leave viewer');
        await give(approver, { 'hr.leave': ['approve'] });
        await give(viewer, { 'hr.leave': ['view'] });
        const mark = await maxNotification();
        await as('PHARMACIST', PHARMACIST);
        const res = await (await import('@/app/api/hr/me/leave/route')).POST(post('/x', { leaveTypeId: 1, dayPart: 'FULL', start: '2027-05-03', end: '2027-05-03' }));
        expect(res.status).toBe(201);
        expect(await got(approver, 'LEAVE_REQUEST', mark)).toBe(true);
        expect(await got(viewer, 'LEAVE_REQUEST', mark)).toBe(false);
        expect(await got(ADMIN, 'LEAVE_REQUEST', mark)).toBe(true);                 // administrators start with HR
        const id = (await res.json()).id;
        await query(`DELETE FROM leave_requests WHERE id = ?`, [id]);
    });

    it('a doctor\'s new leave tells the front desk, including anyone given appointments access', async () => {
        const helper = await makeStaff('STAFF', 'Desk helper');
        await give(helper, { 'reception.appointments': ['view'] });
        const date = isoDate(150);
        await query(`INSERT INTO appointments (patient_id, doctor_id, date, time_slot, queue_number, status) VALUES (?, ?, ?, '10:00', 1, 'PENDING')`, [ALICE, DOCTOR_TWO, date]);
        const mark = await maxNotification();
        await as('ADMIN', ADMIN);
        const res = await (await import('@/app/api/admin/doctors/[id]/leaves/route')).POST(post('/x', { from: date }), ctx(DOCTOR_TWO));
        expect(res.status).toBe(201);
        expect(await got(helper, 'DOCTOR_LEAVE', mark)).toBe(true);
        expect(await got(RECEPTIONIST, 'DOCTOR_LEAVE', mark)).toBe(true);
    });

    it('the bell works for every kind of account, including the HR manager and other staff (the fixed list used to leave the HR manager out)', async () => {
        const hr = await makeStaff('HR_MANAGER', 'HR bell');
        const other = await makeStaff('STAFF', 'Other bell');
        for (const [role, id] of [['HR_MANAGER', hr], ['STAFF', other], ['DOCTOR', DOCTOR], ['PATIENT', ALICE], ['ADMIN', ADMIN]] as const) {
            await as(role, id);
            expect((await (await import('@/app/api/notifications/route')).GET(new Request('http://x'))).status, role).toBe(200);
            expect((await (await import('@/app/api/notifications/read/route')).POST(post('/x', { all: true }))).status, role).toBeLessThan(500);
        }
    });
});

describe('shared routes follow permissions, not roles', () => {
    const listAppointments = async (query = '') => (await import('@/app/api/appointments/route')).GET(new Request(`http://x/api/appointments${query}`));
    const detail = async (id: number) => (await import('@/app/api/appointments/[id]/route')).GET(new Request('http://x'), ctx(id));
    const cancel = async (id: number) => (await import('@/app/api/appointments/cancel/route')).PUT(post('/x', { appointmentId: id }, 'PUT'));

    it('a doctor sees only their own appointments and never another doctor\'s; the front desk sees all', async () => {
        const mine = await makeAppointment(ALICE);                                   // Dr. Smith (2)
        const theirs = (await query<any>(`INSERT INTO appointments (patient_id, doctor_id, date, time_slot, queue_number, status) VALUES (?, ?, ?, '11:00', 1, 'PENDING')`, [BOB, DOCTOR_TWO, isoDate(160)])).insertId as number;
        await as('DOCTOR', DOCTOR);
        const ids = (await (await listAppointments()).json()).map((a: any) => a.id);
        expect(ids).toContain(mine);
        expect(ids).not.toContain(theirs);
        expect((await detail(mine)).status).toBe(200);
        expect((await detail(theirs)).status).toBe(403);
        await as('RECEPTIONIST', RECEPTIONIST);
        const all = [...(await (await listAppointments(`?doctorId=${DOCTOR}`)).json()), ...(await (await listAppointments(`?doctorId=${DOCTOR_TWO}`)).json())].map((a: any) => a.id);
        expect(all).toEqual(expect.arrayContaining([mine, theirs]));
        expect((await detail(theirs)).status).toBe(200);
    });

    it('a person with only "consultations" who is not that doctor sees nobody else\'s appointments (it is not the front desk)', async () => {
        const other = await makeStaff('STAFF', 'Consult only');
        await give(other, { consultations: ['view'] });
        const appt = await makeAppointment(ALICE);
        await as('STAFF', other);
        expect((await (await listAppointments()).json())).toEqual([]);
        expect((await detail(appt)).status).toBe(403);
    });

    it('a person given the front desk\'s appointments permission sees everything, whatever their job', async () => {
        const helper = await makeStaff('PHARMACIST', 'Pharmacist at the desk');
        await give(helper, { 'reception.appointments': ['view', 'change'] });
        const appt = await makeAppointment(ALICE);
        await as('PHARMACIST', helper);
        expect((await (await listAppointments(`?doctorId=${DOCTOR}`)).json()).map((a: any) => a.id)).toContain(appt);       // not just their own
        expect((await detail(appt)).status).toBe(200);
        expect((await cancel(appt)).status).toBe(200);
    });

    it('cancelling: the front desk any visit, a doctor only their own, "consultations" alone not someone else\'s', async () => {
        const other = await makeStaff('STAFF', 'Cancel check');
        await give(other, { consultations: ['change'] });
        const mine = await makeAppointment(ALICE);
        const theirs = (await query<any>(`INSERT INTO appointments (patient_id, doctor_id, date, time_slot, queue_number, status) VALUES (?, ?, ?, '12:00', 1, 'PENDING')`, [BOB, DOCTOR_TWO, isoDate(161)])).insertId as number;
        await as('DOCTOR', DOCTOR);
        expect((await cancel(theirs)).status).toBe(403);
        await as('STAFF', other);
        expect((await cancel(mine)).status).toBe(403);                               // not their patient
        await as('DOCTOR', DOCTOR);
        expect((await cancel(mine)).status).toBe(200);
        await as('RECEPTIONIST', RECEPTIONIST);
        expect((await cancel(theirs)).status).toBe(200);
    });

    it('private clinical notes are shown only to the visit\'s own doctor', async () => {
        const appt = await makeAppointment(ALICE);
        await consult(appt, { status: 'ONGOING', notes: 'private working note' });
        await as('DOCTOR', DOCTOR);
        expect((await (await detail(appt)).json()).appointment?.notes ?? (await (await detail(appt)).json()).notes).toBe('private working note');
        await as('RECEPTIONIST', RECEPTIONIST);
        const seen = await (await detail(appt)).json();
        expect(JSON.stringify(seen)).not.toContain('private working note');
        await as('ADMIN', ADMIN);
        expect(JSON.stringify(await (await detail(appt)).json())).not.toContain('private working note');
    });

    it('lab reports: the lab reads any, a doctor only their own patients\', anyone else is refused', async () => {
        const mine = await makeAppointment(ALICE);
        const theirs = (await query<any>(`INSERT INTO appointments (patient_id, doctor_id, date, time_slot, queue_number, status) VALUES (?, ?, ?, '13:00', 1, 'COMPLETED')`, [BOB, DOCTOR_TWO, isoDate(162)])).insertId as number;
        const report = async (appt: number) => (await query<any>(`INSERT INTO lab_requests (appointment_id, test_id, status, result_file, completed_at) VALUES (?, 1, 'COMPLETED', ?, NOW())`, [appt, `1-${randomUUID()}.pdf`])).insertId as number;
        const [a, b] = [await report(mine), await report(theirs)];
        const read = async (id: number) => (await import('@/app/api/lab-reports/[id]/route')).GET(new Request('http://x'), ctx(id));
        await as('DOCTOR', DOCTOR);
        expect((await read(a)).status).toBe(404);                                    // allowed: the stored file is simply not on disk here
        expect((await read(b)).status).toBe(403);
        await as('LAB_ASSISTANT', LAB);
        expect((await read(b)).status).toBe(404);
        await as('PHARMACIST', PHARMACIST);
        expect((await read(a)).status).toBe(403);
    });
});

describe('"Other staff": a role with no duties of its own', () => {
    it('can be created and starts with only My Work and Account', async () => {
        await as('ADMIN', ADMIN);
        const res = await (await import('@/app/api/users/route')).POST(post('/x', { name: 'New Clerk', email: `clerk.${uniq()}@access.test`, password: 'Correct-Horse-1', role: 'STAFF' }));
        expect(res.status).toBe(201);
        const clerk = await one(`SELECT id FROM users WHERE name = 'New Clerk' ORDER BY id DESC LIMIT 1`);
        created.push(clerk.id);
        await as('STAFF', clerk.id);
        const me = await (await (await import('@/app/api/access/me/route')).GET()).json();
        expect(Object.keys(me.grants).sort()).toEqual(['my.account', 'my.work']);
        expect((await (await import('@/app/api/hr/me/today/route')).GET()).status).toBe(200);
        expect((await (await import('@/app/api/receptionist/billing/route')).GET(new Request('http://x'))).status).toBe(403);
        expect((await (await import('@/app/api/pharmacist/prescriptions/route')).GET(new Request('http://x'))).status).toBe(403);
    });

    it('gets exactly what is given, one screen at a time (a billing clerk)', async () => {
        const clerk = await makeStaff('STAFF', 'Billing clerk');
        await give(clerk, { billing: ['view', 'approve'], 'reception.patients': ['view'] });
        const billing = async () => (await (await import('@/app/api/receptionist/billing/route')).GET(new Request('http://x'))).status;
        await as('STAFF', clerk);
        expect(await billing()).toBe(200);
        expect((await (await import('@/app/api/receptionist/patients/route')).GET(new Request('http://x'))).status).toBe(200);
        expect((await (await import('@/app/api/receptionist/appointments/route')).GET(new Request('http://x'))).status).toBe(403);
        const me = await (await (await import('@/app/api/access/me/route')).GET()).json();
        expect(Object.keys(me.grants).sort()).toEqual(['billing', 'my.account', 'my.work', 'reception.patients']);
    });

    it('appears in the HR roster and employee list like any other member of staff', async () => {
        const clerk = await makeStaff('STAFF', 'Roster clerk');
        await as('ADMIN', ADMIN);
        const list = await (await (await import('@/app/api/hr/employees/route')).GET(new Request('http://x/api/hr/employees'))).json();
        expect(list.employees.some((e: any) => e.id === clerk)).toBe(true);
    });

    it('its starting profile can be edited like any role\'s, and a person can be moved to it', async () => {
        const mover = await makeStaff('RECEPTIONIST', 'Moves to staff');
        await as('ADMIN', ADMIN);
        const put = await (await import('@/app/api/users/route')).PUT(post('/x', { id: mover, name: 'Moves to staff', email: `mover.${uniq()}@access.test`, role: 'STAFF' }, 'PUT'));
        expect(put.status).toBe(200);
        await as('STAFF', mover);
        const me = await (await (await import('@/app/api/access/me/route')).GET()).json();
        expect(Object.keys(me.grants).sort()).toEqual(['my.account', 'my.work']);
    });
});

describe('upgrades: screens added after a role was set up', () => {
    it('are closed to the role until added, and adding them uses the starting ticks and never changes what exists', async () => {
        const stored = async () => (await rows(`SELECT g.resource FROM access_profiles p JOIN access_grants g ON g.profile_id = p.id WHERE p.system_role = 'DOCTOR'`)).length;
        const before = await stored();
        await query(`DELETE g FROM access_grants g JOIN access_profiles p ON p.id = g.profile_id WHERE p.system_role = 'DOCTOR' AND g.resource = 'lab.tests'`);
        await setRoleTicks('DOCTOR', 'doctor.earnings', []);                            // an edit that must survive
        await as('DOCTOR', DOCTOR);
        expect((await (await import('@/app/api/lab-assistant/tests/route')).GET(new Request('http://x'))).status).toBe(403);   // no row: closed

        await as('ADMIN', ADMIN);
        const list = await (await (await import('@/app/api/admin/access/profiles/route')).GET()).json();
        expect(list.roles.find((r: any) => r.role === 'DOCTOR').missing).toEqual(['lab.tests']);

        const fill = (await import('@/app/api/admin/access/roles/[role]/route')).POST;
        const first = await (await fill(post('/x', {}), { params: Promise.resolve({ role: 'DOCTOR' }) })).json();
        expect(first.added).toBe(1);
        expect(await stored()).toBe(before);
        await as('DOCTOR', DOCTOR);
        expect((await (await import('@/app/api/lab-assistant/tests/route')).GET(new Request('http://x'))).status).toBe(200);
        expect((await (await import('@/app/api/doctor/earnings/route')).GET(new Request('http://x'))).status).toBe(403);       // the earlier edit was not undone
        await as('ADMIN', ADMIN);
        expect((await (await fill(post('/x', {}), { params: Promise.resolve({ role: 'DOCTOR' }) })).json()).added).toBe(0);     // safe to repeat
        await restoreRole('DOCTOR');
    });
});

describe('own work and account are permissions too', () => {
    it('without "My Work", clocking in is refused but nothing else changes', async () => {
        await setRoleTicks('LAB_ASSISTANT', 'my.work', []);
        await as('LAB_ASSISTANT', LAB);
        expect((await (await import('@/app/api/hr/me/clock/route')).POST(post('/x', { action: 'IN' }))).status).toBe(403);
        expect((await (await import('@/app/api/hr/me/today/route')).GET()).status).toBe(403);
        expect((await (await import('@/app/api/lab-assistant/requests/route')).GET(new Request('http://x'))).status).toBe(200);
        await restoreRole('LAB_ASSISTANT');
        expect((await (await import('@/app/api/hr/me/today/route')).GET()).status).toBe(200);
    });

    it('"My Work" view without "add" can look but not clock in, request leave or request corrections', async () => {
        await setRoleTicks('LAB_ASSISTANT', 'my.work', ['view']);
        await as('LAB_ASSISTANT', LAB);
        expect((await (await import('@/app/api/hr/me/today/route')).GET()).status).toBe(200);
        expect((await (await import('@/app/api/hr/me/clock/route')).POST(post('/x', { action: 'IN' }))).status).toBe(403);
        expect((await (await import('@/app/api/hr/me/leave/route')).POST(post('/x', { leaveTypeId: 1, dayPart: 'FULL', start: '2027-06-07', end: '2027-06-07' }))).status).toBe(403);
        expect((await (await import('@/app/api/hr/me/corrections/route')).POST(post('/x', {}))).status).toBe(403);
        await restoreRole('LAB_ASSISTANT');
    });

    it('the account page follows "My account"; patients keep theirs whatever is configured', async () => {
        await setRoleTicks('LAB_ASSISTANT', 'my.account', ['view']);
        await as('LAB_ASSISTANT', LAB);
        const account = await import('@/app/api/account/route');
        expect((await account.GET()).status).toBe(200);
        expect((await account.PUT(post('/x', { name: 'Mike Ross', phone: '0715566778' }, 'PUT'))).status).toBe(403);
        await restoreRole('LAB_ASSISTANT');
        await as('PATIENT', ALICE);
        expect((await account.GET()).status).toBe(200);
    });
});

describe('two administrators editing the same role', () => {
    it('save and reset at the same time without errors, ending with one consistent profile', async () => {
        const { identity } = await import('../helpers/state');
        const { tokenFor } = await import('../helpers/auth');
        const token = await tokenFor('ADMIN', ADMIN);
        const route = await import('@/app/api/admin/access/roles/[role]/route');
        const p = { params: Promise.resolve({ role: 'RECEPTIONIST' }) };
        const calls = [
            () => route.PUT(post('/x', { grants: { billing: { view: true } } }, 'PUT'), p),
            () => route.DELETE(new Request('http://x', { method: 'DELETE' }), p),
            () => route.POST(post('/x', {}), p),
            () => route.PUT(post('/x', { grants: { billing: { view: true, approve: true } } }, 'PUT'), p),
        ];
        const results = await Promise.all(calls.map((c) => identity.run(token, c)));
        expect(results.every((r: Response) => r.status < 500), results.map((r: Response) => r.status).join(',')).toBe(true);
        expect(await rows(`SELECT 1 FROM access_profiles WHERE system_role = 'RECEPTIONIST'`)).toHaveLength(1);
        expect(await rows(`SELECT g.resource FROM access_profiles p JOIN access_grants g ON g.profile_id = p.id WHERE p.system_role = 'RECEPTIONIST'`)).toHaveLength(RESOURCE_KEYS.length);
        await restoreRole('RECEPTIONIST');
    });
});

describe('the access window under unusual input', () => {
    const user = '@/app/api/admin/access/users/[id]/route';
    const put = async (body: unknown, id: number) => { await as('ADMIN', ADMIN); return (await import(user)).PUT(post('/x', body, 'PUT'), ctx(id)); };

    it('refuses nonsense bodies without changing anything', async () => {
        const target = await makeStaff('STAFF', 'Nonsense target');
        for (const body of [
            {}, { profileIds: 'x', personal: {} }, { profileIds: [1.5], personal: {} }, { profileIds: [-1], personal: {} },
            { profileIds: Array.from({ length: 31 }, (_, i) => i + 1), personal: {} },
            { profileIds: [], personal: { 'no.such': { view: true } } }, { profileIds: [], personal: { billing: { view: 'yes' } } },
            { profileIds: [], personal: [] }, { profileIds: [], personal: null }, null,
        ]) expect((await put(body, target)).status, JSON.stringify(body)).toBe(400);
        expect(await rows(`SELECT 1 FROM user_access_profiles WHERE user_id = ?`, [target])).toHaveLength(0);
    });

    it('the same profile listed twice is given once', async () => {
        const target = await makeStaff('STAFF', 'Duplicate target');
        await as('ADMIN', ADMIN);
        const { id } = await (await (await import('@/app/api/admin/access/profiles/route')).POST(post('/x', { name: `Dup ${uniq()}`, grants: { billing: { view: true } } }))).json();
        expect((await put({ profileIds: [id, id, id], personal: {} }, target)).status).toBe(200);
        expect(await rows(`SELECT 1 FROM user_access_profiles WHERE user_id = ? AND profile_id = ?`, [target, id])).toHaveLength(1);
    });

    it('searching with odd characters is safe (quotes, wildcards, very long text)', async () => {
        await as('ADMIN', ADMIN);
        const search = async (q: string) => (await import('@/app/api/admin/access/users/route')).GET(new Request(`http://x/api/admin/access/users?q=${encodeURIComponent(q)}`));
        for (const q of ["'; DROP TABLE users; --", '%', '_', '\\', 'a'.repeat(500), '𝒳', '   ']) expect((await search(q)).status, q).toBe(200);
        expect(await rows(`SELECT 1 FROM users LIMIT 1`)).toHaveLength(1);
    });

    it('two administrators saving the same person at once both succeed and leave a consistent result', async () => {
        const target = await makeStaff('STAFF', 'Race target');
        const body = (billing: boolean) => ({ profileIds: [], personal: billing ? { billing: { view: true } } : { 'reception.patients': { view: true } } });
        await as('ADMIN', ADMIN);
        const { identity } = await import('../helpers/state');
        const { tokenFor } = await import('../helpers/auth');
        const token = await tokenFor('ADMIN', ADMIN);
        const handler = (await import(user)).PUT;
        const results = await Promise.all([true, false, true, false].map((b) => identity.run(token, () => handler(post('/x', body(b), 'PUT'), ctx(target)))));
        expect(results.every((r: Response) => r.status < 500)).toBe(true);
        const own = await rows(`SELECT g.resource FROM access_profiles p JOIN access_grants g ON g.profile_id = p.id WHERE p.owner_user_id = ?`, [target]);
        expect(own).toHaveLength(1);                                                 // one set or the other, never a mixture
    });

    it('a person\'s own and given access is removed when they are deleted', async () => {
        const target = await makeStaff('STAFF', 'Leaver');
        const profile = await give(target, { billing: ['view'] });
        await put({ profileIds: [profile], personal: { 'hr.leave': { view: true } } }, target);
        expect(await rows(`SELECT 1 FROM access_profiles WHERE owner_user_id = ?`, [target])).toHaveLength(1);
        await as('ADMIN', ADMIN);
        expect((await (await import('@/app/api/users/route')).DELETE(new Request(`http://x/api/users?id=${target}`, { method: 'DELETE' }))).status).toBe(200);
        expect(await rows(`SELECT 1 FROM access_profiles WHERE owner_user_id = ?`, [target])).toHaveLength(0);
        expect(await rows(`SELECT 1 FROM user_access_profiles WHERE user_id = ?`, [target])).toHaveLength(0);
        expect(await rows(`SELECT 1 FROM access_profiles WHERE id = ?`, [profile])).toHaveLength(1);       // the shared profile stays for others
    });

    it('a deleted profile takes its grants with it and its holders lose what it gave', async () => {
        const target = await makeStaff('STAFF', 'Profile holder');
        const profile = await give(target, { billing: ['view'] });
        await as('STAFF', target);
        const status = async () => (await (await import('@/app/api/receptionist/billing/route')).GET(new Request('http://x'))).status;
        expect(await status()).toBe(200);
        await as('ADMIN', ADMIN);
        expect((await (await import('@/app/api/admin/access/profiles/[id]/route')).DELETE(new Request('http://x', { method: 'DELETE' }), ctx(profile))).status).toBe(200);
        await as('STAFF', target);
        expect(await status()).toBe(403);
    });

    it('profile names are trimmed, may use any language, and cannot collide with a role\'s name', async () => {
        await as('ADMIN', ADMIN);
        const create = async (name: string) => (await import('@/app/api/admin/access/profiles/route')).POST(post('/x', { name, grants: {} }));
        const res = await create(`   වෛද්‍ය සහායක ${uniq()}   `);
        expect(res.status).toBe(201);
        const { id } = await res.json();
        expect((await one(`SELECT name FROM access_profiles WHERE id = ?`, [id])).name.startsWith(' ')).toBe(false);
        expect((await create('Role: DOCTOR')).status).toBe(409);
    });
});

describe('what the menu is built from', () => {
    it('each role\'s access report lists the screens it can open, and a patient\'s is empty', async () => {
        const grantsOf = async (role: any, id: number) => { await as(role, id); return (await (await import('@/app/api/access/me/route')).GET()).json(); };
        const doctor = await grantsOf('DOCTOR', DOCTOR);
        expect(doctor.grants.consultations).toEqual({ view: true, add: true, change: true, approve: true });
        expect(doctor.grants.billing).toBeUndefined();
        expect((await grantsOf('PATIENT', ALICE)).grants).toEqual({});
        const admin = await grantsOf('ADMIN', ADMIN);
        expect(admin.grants['access.config']).toEqual({ view: true, change: true });
    });

    it('a change in the access window shows up in the very next report', async () => {
        const person = await makeStaff('STAFF', 'Menu check');
        await as('STAFF', person);
        const report = async () => (await (await import('@/app/api/access/me/route')).GET()).json();
        expect((await report()).grants.billing).toBeUndefined();
        await give(person, { billing: ['view'] });
        expect((await report()).grants.billing).toEqual({ view: true });
    });
});

afterAll(async () => {
    // Remove what these tests created (profiles and links go with the users)
    if (created.length) {
        await query(`DELETE FROM access_profiles WHERE owner_user_id IN (${created.map(() => '?').join(',')})`, created).catch(() => {});
        await query(`DELETE FROM users WHERE id IN (${created.map(() => '?').join(',')})`, created).catch(() => {});
    }
});
