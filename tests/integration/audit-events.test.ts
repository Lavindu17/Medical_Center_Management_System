import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { SignJWT } from 'jose';
import { pool, query } from '@/lib/db';
import { state } from '../helpers/state';
import { as, post, one, rows, makeAppointment, ALICE, BOB, DOCTOR, PHARMACIST, RECEPTIONIST } from './helpers';

// Which actions leave a trail, what the trail contains, and who may read it.

afterAll(async () => { await pool.end(); });
beforeEach(() => { state.token = null; });

const ADMIN = 1;
const latest = (where: string, params: any[] = []) => one(`SELECT * FROM audit_log WHERE ${where} ORDER BY id DESC LIMIT 1`, params);
const count = async (where: string, params: any[] = []) => Number((await one(`SELECT COUNT(*) AS n FROM audit_log WHERE ${where}`, params)).n);

describe('reads of a patient record are logged', () => {
    it('a doctor opening a chart', async () => {
        await as('DOCTOR', DOCTOR);
        const { GET } = await import('@/app/api/doctor/patients/[id]/route');
        expect((await GET(new Request('http://x'), { params: Promise.resolve({ id: String(ALICE) }) })).status).toBe(200);
        expect(await latest(`action = 'VIEW' AND entity_type = 'PATIENT_CHART' AND actor_id = ? AND patient_id = ?`, [DOCTOR, ALICE])).toMatchObject({ actor_role: 'DOCTOR', outcome: 'SUCCESS' });
    });

    it('a patient reading their own record is not logged', async () => {
        const before = await count(`patient_id = ? AND actor_id = ?`, [ALICE, ALICE]);
        await as('PATIENT', ALICE);
        const { GET } = await import('@/app/api/patient/records/route');
        expect((await GET(new Request('http://x?type=bills'))).status).toBe(200);
        expect(await count(`patient_id = ? AND actor_id = ?`, [ALICE, ALICE])).toBe(before);
    });

    it('a family member acting as the patient is logged under their own name', async () => {
        state.token = await new SignJWT({ id: BOB, email: 'bob@test.local', role: 'PATIENT', name: 'Bob', actorId: ALICE, actorName: 'Alice' })
            .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1d').sign(new TextEncoder().encode(process.env.JWT_SECRET!));
        const { GET } = await import('@/app/api/patient/records/route');
        expect((await GET(new Request('http://x?type=bills'))).status).toBe(200);
        expect(await latest(`patient_id = ? AND on_behalf_of_id = ?`, [BOB, BOB])).toMatchObject({ actor_id: ALICE, actor_name: 'Alice', action: 'VIEW' });
    });

    it('a patient search records that a search happened, not what was typed', async () => {
        await as('RECEPTIONIST', RECEPTIONIST);
        const { GET } = await import('@/app/api/receptionist/patients/route');
        await GET(new Request('http://x?q=SecretName'));
        const r = await latest(`action = 'SEARCH' AND actor_id = ?`, [RECEPTIONIST]);
        expect(r.details).not.toContain('SecretName');
        expect(JSON.parse(r.details)).toMatchObject({ term: true, termLength: 10 });
    });
});

describe('changes are logged', () => {
    it('consultation save, with counts but never clinical notes', async () => {
        const appt = await makeAppointment(ALICE, 'CHECKED_IN');
        await as('DOCTOR', DOCTOR);
        const { POST } = await import('@/app/api/doctor/consultation/save/route');
        const res = await POST(post('/x', { appointmentId: appt, status: 'ONGOING', vitals: {}, notes: 'highly confidential diagnosis' }));
        expect(res.status).toBe(200);
        const r = await latest(`entity_type = 'CONSULTATION' AND entity_id = ?`, [String(appt)]);
        expect(r).toMatchObject({ action: 'UPDATE', patient_id: ALICE, actor_id: DOCTOR });
        expect(r.details).not.toContain('confidential');
    });

    it('a cancellation', async () => {
        await as('PATIENT', ALICE);
        const appt = await makeAppointment(ALICE, 'PENDING');
        const { PUT } = await import('@/app/api/appointments/cancel/route');
        expect((await PUT(post('/x', { appointmentId: appt }, 'PUT'))).status).toBe(200);
        expect(await latest(`entity_type = 'APPOINTMENT' AND entity_id = ? AND action = 'STATUS_CHANGE'`, [String(appt)]))
            .toMatchObject({ patient_id: ALICE, actor_id: ALICE });
    });

    it('administrator user changes record which fields changed, not their values', async () => {
        await as('ADMIN', ADMIN);
        const [u]: any = await query(`SELECT id, name, email, phone, role FROM users WHERE id = ?`, [RECEPTIONIST]);
        const { PUT } = await import('@/app/api/users/route');
        const res = await PUT(post('/x', { id: u.id, name: 'Lisa Renamed', email: u.email, phone: u.phone ?? '', role: u.role }, 'PUT'));
        expect(res.status).toBe(200);
        const r = await latest(`entity_type = 'USER' AND entity_id = ? AND action = 'UPDATE'`, [String(u.id)]);
        expect(JSON.parse(r.details).fields).toContain('name');
        expect(r.details).not.toContain('Lisa Renamed');
        await PUT(post('/x', { id: u.id, name: u.name, email: u.email, phone: u.phone ?? '', role: u.role }, 'PUT'));
    });
});

describe('security events', () => {
    it('a wrong-role request is logged as denied', async () => {
        await as('PATIENT', ALICE);
        const { GET } = await import('@/app/api/pharmacist/stats/route');
        expect((await GET(new Request('http://x'))).status).toBe(403);
        expect(await latest(`action = 'ACCESS_DENIED' AND actor_id = ?`, [ALICE])).toMatchObject({ outcome: 'DENIED', actor_role: 'PATIENT' });
    });

    it('sign-in failures name the email but never the password', async () => {
        const { POST } = await import('@/app/api/auth/login/route');
        await query('DELETE FROM rate_limits');
        const res = await POST(post('/x', { email: 'nobody@audit-test.local', password: 'Sup3rSecret!' }));
        expect(res.status).toBe(401);
        const r = await latest(`action = 'LOGIN_FAILED' AND details LIKE '%nobody@audit-test.local%'`);
        expect(r).toMatchObject({ outcome: 'FAILURE', actor_id: null });
        expect(r.details).not.toContain('Sup3rSecret');
    });

    it('a password change is recorded without either password', async () => {
        await as('PATIENT', ALICE);
        const { POST } = await import('@/app/api/auth/change-password/route');
        await query('DELETE FROM rate_limits');
        await POST(post('/x', { currentPassword: 'definitely-wrong-1', newPassword: 'another-pass-2' }));
        const r = await latest(`action = 'PASSWORD_CHANGE' AND actor_id = ?`, [ALICE]);
        expect(r.outcome).toBe('FAILURE');
        expect(r.details).not.toContain('definitely-wrong');
        expect(r.details).not.toContain('another-pass');
    });
});

describe('who can read the trail', () => {
    it('only administrators can list, export or verify it', async () => {
        const list = await import('@/app/api/admin/audit/route');
        const exp = await import('@/app/api/admin/audit/export/route');
        const ver = await import('@/app/api/admin/audit/verify/route');
        for (const [role, id] of [['PATIENT', ALICE], ['DOCTOR', DOCTOR], ['PHARMACIST', PHARMACIST], ['RECEPTIONIST', RECEPTIONIST]] as const) {
            await as(role, id);
            expect((await list.GET(new Request('http://x'))).status).toBe(403);
            expect((await exp.GET(new Request('http://x'))).status).toBe(403);
            expect((await ver.POST()).status).toBe(403);
        }
        state.token = null;
        expect((await list.GET(new Request('http://x'))).status).toBe(401);
    });

    it('an administrator can filter, export (and the export is itself logged) and verify', async () => {
        await as('ADMIN', ADMIN);
        const list = await import('@/app/api/admin/audit/route');
        const body = await (await list.GET(new Request(`http://x?action=VIEW&entity=PATIENT_CHART&patient=${ALICE}`))).json();
        expect(body.rows.length).toBeGreaterThan(0);
        expect(body.rows.every((r: any) => r.action === 'VIEW' && r.patient_id === ALICE)).toBe(true);

        const exp = await import('@/app/api/admin/audit/export/route');
        const csv = await exp.GET(new Request(`http://x?patient=${ALICE}`));
        expect(csv.headers.get('content-type')).toContain('text/csv');
        const text = await csv.text();
        expect(text.split('\r\n')[0]).toContain('occurred_at_utc');
        expect(await latest(`action = 'EXPORT' AND actor_id = ?`, [ADMIN])).toMatchObject({ entity_type: 'AUDIT_LOG' });

        const ver = await import('@/app/api/admin/audit/verify/route');
        expect((await (await ver.POST()).json()).ok).toBe(true);
    });

    it('ignores malformed filters instead of passing them to the database', async () => {
        await as('ADMIN', ADMIN);
        const list = await import('@/app/api/admin/audit/route');
        const hostile = encodeURIComponent("VIEW' OR 1=1 --");
        const res = await list.GET(new Request(`http://x?action=${hostile}&patient=abc&from=yesterday`));
        expect(res.status).toBe(200);
    });
});

describe('patient access history', () => {
    it('shows staff access to the patient, never their own, and never addresses or details', async () => {
        await as('DOCTOR', DOCTOR);
        const chart = await import('@/app/api/doctor/patients/[id]/route');
        await chart.GET(new Request('http://x'), { params: Promise.resolve({ id: String(ALICE) }) });

        await as('PATIENT', ALICE);
        const { GET } = await import('@/app/api/patient/access-log/route');
        const body = await (await GET(new Request('http://x'))).json();
        expect(body.rows.length).toBeGreaterThan(0);
        expect(body.rows.some((r: any) => r.actor_role === 'DOCTOR' && r.action === 'VIEW')).toBe(true);
        for (const r of body.rows) {
            expect(r).not.toHaveProperty('ip');
            expect(r).not.toHaveProperty('details');
            expect(r.actor_name).not.toBeNull();
        }
    });

    it("one patient cannot see another patient's history", async () => {
        await as('PATIENT', BOB);
        const { GET } = await import('@/app/api/patient/access-log/route');
        const body = await (await GET(new Request(`http://x?patient=${ALICE}`))).json();
        const aliceRows = await rows(`SELECT id FROM audit_log WHERE patient_id = ?`, [ALICE]);
        const aliceIds = new Set(aliceRows.map((r: any) => r.id));
        expect(body.rows.every((r: any) => !aliceIds.has(r.id))).toBe(true);
    });

    it('only patients can use it', async () => {
        await as('DOCTOR', DOCTOR);
        const { GET } = await import('@/app/api/patient/access-log/route');
        expect((await GET(new Request('http://x'))).status).toBe(403);
    });
});

describe('the trail stays intact after all of this', () => {
    it('verifies', async () => {
        const { verifyChain } = await import('@/lib/audit');
        expect((await verifyChain()).ok).toBe(true);
    });
});
