import { describe, it, expect, afterAll } from 'vitest';
import { pool, query } from '@/lib/db';
import { ALICE, DOCTOR, PHARMACIST, RECEPTIONIST, as, post, ctx, rows, makeAppointment, consult } from './helpers';

// What a site can now configure: a pharmacist who also handles billing, a doctor who may write notes but not complete,
// a front desk that loses a permission. Changes apply on the next request.
afterAll(async () => { await pool.end(); });

const ADMIN = 1;
const tag = () => `t${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function profile(name: string, grants: Record<string, string[]>, users: number[] = []) {
    const p: any = await query(`INSERT INTO access_profiles (name) VALUES (?)`, [name]);
    for (const [resource, levels] of Object.entries(grants)) {
        await query(`INSERT INTO access_grants (profile_id, resource, can_view, can_add, can_change, can_approve) VALUES (?, ?, ?, ?, ?, ?)`,
            [p.insertId, resource, +levels.includes('view'), +levels.includes('add'), +levels.includes('change'), +levels.includes('approve')]);
    }
    for (const u of users) await query(`INSERT INTO user_access_profiles (user_id, profile_id) VALUES (?, ?)`, [u, p.insertId]);
    return p.insertId as number;
}
const status = async (role: any, id: number, handler: () => Promise<Response>) => { await as(role, id); return (await handler()).status; };
const billingList = async () => (await import('@/app/api/receptionist/billing/route')).GET(new Request('http://x/api/receptionist/billing'));
const dispenseQueue = async () => (await import('@/app/api/pharmacist/prescriptions/route')).GET(new Request('http://x/api/pharmacist/prescriptions'));

describe('a pharmacist who also handles billing', () => {
    it('gains billing when given a profile, and loses it again when the profile is removed', async () => {
        expect(await status('PHARMACIST', PHARMACIST, billingList)).toBe(403);
        const id = await profile(`Billing ${tag()}`, { billing: ['view', 'approve'] }, [PHARMACIST]);
        expect(await status('PHARMACIST', PHARMACIST, billingList)).toBe(200);
        // and can record a payment (the approve level), which a view-only person cannot
        await as('PHARMACIST', PHARMACIST);
        const { POST } = await import('@/app/api/receptionist/billing/route');
        expect((await POST(post('/x', { billId: 999999 }))).status).not.toBe(403);
        await query(`DELETE FROM user_access_profiles WHERE profile_id = ?`, [id]);
        expect(await status('PHARMACIST', PHARMACIST, billingList)).toBe(403);
        await query(`DELETE FROM access_profiles WHERE id = ?`, [id]);
    });

    it('view alone lets them see bills but not record payments', async () => {
        const id = await profile(`BillView ${tag()}`, { billing: ['view'] }, [PHARMACIST]);
        expect(await status('PHARMACIST', PHARMACIST, billingList)).toBe(200);
        await as('PHARMACIST', PHARMACIST);
        const { POST } = await import('@/app/api/receptionist/billing/route');
        expect((await POST(post('/x', { billId: 1 }))).status).toBe(403);
        await query(`DELETE FROM access_profiles WHERE id = ?`, [id]);
    });

    it('a person\'s own ticks work the same way', async () => {
        const p: any = await query(`INSERT INTO access_profiles (name, owner_user_id) VALUES (?, ?)`, [`__user_${PHARMACIST}_${tag()}`, PHARMACIST]);
        await query(`INSERT INTO access_grants (profile_id, resource, can_view) VALUES (?, 'billing', 1)`, [p.insertId]);
        await query(`INSERT INTO user_access_profiles (user_id, profile_id) VALUES (?, ?)`, [PHARMACIST, p.insertId]);
        expect(await status('PHARMACIST', PHARMACIST, billingList)).toBe(200);
        await query(`DELETE FROM access_profiles WHERE id = ?`, [p.insertId]);
        expect(await status('PHARMACIST', PHARMACIST, billingList)).toBe(403);
    });
});

describe('editing a role\'s own profile', () => {
    it('takes a permission away from everyone with that role, and "reset" is just deleting the stored copy', async () => {
        expect(await status('PHARMACIST', PHARMACIST, dispenseQueue)).toBe(200);
        const p: any = await query(`INSERT INTO access_profiles (name, system_role) VALUES (?, 'PHARMACIST')`, [`Pharmacist ${tag()}`]);
        await query(`INSERT INTO access_grants (profile_id, resource) VALUES (?, 'pharmacy.dispensing')`, [p.insertId]);   // all four off
        expect(await status('PHARMACIST', PHARMACIST, dispenseQueue)).toBe(403);
        const alerts = (await import('@/app/api/pharmacist/alerts/route')).GET;
        expect(await status('PHARMACIST', PHARMACIST, () => alerts())).toBe(200);     // not listed: keeps its default
        await query(`DELETE FROM access_profiles WHERE id = ?`, [p.insertId]);
        expect(await status('PHARMACIST', PHARMACIST, dispenseQueue)).toBe(200);
    });

    it('does not touch other roles', async () => {
        const p: any = await query(`INSERT INTO access_profiles (name, system_role) VALUES (?, 'RECEPTIONIST')`, [`Reception ${tag()}`]);
        await query(`INSERT INTO access_grants (profile_id, resource) VALUES (?, 'billing')`, [p.insertId]);
        expect(await status('RECEPTIONIST', RECEPTIONIST, billingList)).toBe(403);
        expect(await status('PHARMACIST', PHARMACIST, dispenseQueue)).toBe(200);
        await query(`DELETE FROM access_profiles WHERE id = ?`, [p.insertId]);
        expect(await status('RECEPTIONIST', RECEPTIONIST, billingList)).toBe(200);
    });
});

describe('completing a consultation is its own permission', () => {
    it('a doctor without "approve" can save a draft but not complete, and the consultation stays open', async () => {
        const p: any = await query(`INSERT INTO access_profiles (name, system_role) VALUES (?, 'DOCTOR')`, [`Doctor ${tag()}`]);
        await query(`INSERT INTO access_grants (profile_id, resource, can_view, can_add) VALUES (?, 'consultations', 1, 1)`, [p.insertId]);
        const appt = await makeAppointment(ALICE);
        expect((await consult(appt, { status: 'ONGOING' })).status).toBe(200);
        const res = await consult(appt, { status: 'COMPLETED' });
        expect(res.status).toBe(403);
        expect((await res.json()).message).toMatch(/not allowed to complete/i);
        expect((await rows(`SELECT status FROM appointments WHERE id = ?`, [appt]))[0].status).toBe('ONGOING');
        await query(`DELETE FROM access_profiles WHERE id = ?`, [p.insertId]);
        expect((await consult(appt, { status: 'COMPLETED' })).status).toBe(200);
    });
});

describe('administrators and the configuration screen', () => {
    it('an administrator keeps access control even if a stored profile removes everything', async () => {
        const p: any = await query(`INSERT INTO access_profiles (name, system_role) VALUES (?, 'ADMIN')`, [`Admin ${tag()}`]);
        await query(`INSERT INTO access_grants (profile_id, resource) VALUES (?, 'access.config'), (?, 'admin.users')`, [p.insertId, p.insertId]);
        const users = (await import('@/app/api/users/route')).GET;
        expect(await status('ADMIN', ADMIN, () => users(new Request('http://x/api/users')))).toBe(403);          // taken away
        const { grantsFor } = await import('@/lib/access/resolve');
        expect((await grantsFor({ id: ADMIN, role: 'ADMIN' }))['access.config']).toEqual({ view: true, change: true });
        await query(`DELETE FROM access_profiles WHERE id = ?`, [p.insertId]);
        expect(await status('ADMIN', ADMIN, () => users(new Request('http://x/api/users')))).toBe(200);
    });

    it('deleting a user removes their profile links; deleting a profile removes its grants', async () => {
        const id = await profile(`Cascade ${tag()}`, { billing: ['view'] }, [PHARMACIST]);
        await query(`DELETE FROM access_profiles WHERE id = ?`, [id]);
        expect(await rows(`SELECT 1 FROM access_grants WHERE profile_id = ?`, [id])).toHaveLength(0);
        expect(await rows(`SELECT 1 FROM user_access_profiles WHERE profile_id = ?`, [id])).toHaveLength(0);
    });
});

describe('patients are untouched by any of it', () => {
    it('a profile "given" to a patient does nothing on staff screens', async () => {
        const id = await profile(`Sneaky ${tag()}`, { billing: ['view', 'approve'], 'admin.users': ['view', 'add', 'change'] }, [ALICE]);
        expect(await status('PATIENT', ALICE, billingList)).toBe(403);
        expect(await status('PATIENT', ALICE, async () => (await import('@/app/api/users/route')).GET(new Request('http://x/api/users')))).toBe(403);
        await query(`DELETE FROM access_profiles WHERE id = ?`, [id]);
    });
});
