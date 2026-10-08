import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { pool, query } from '@/lib/db';
import { EmailService } from '@/services/email.service';
import { AuthService } from '@/services/auth.service';
import { identity } from '../helpers/state';
import { tokenFor } from '../helpers/auth';
import { ALICE, BOB, DOCTOR, RECEPTIONIST, as, post, ctx, isoDate, one, rows, makeAppointment } from './helpers';

// Plan sections 3 and 8: family links and reception workflows.

afterAll(async () => { await pool.end(); });

let n = 0;
async function newPatient(name = 'Pat Ient') {
    const email = `fam.${Date.now()}.${n++}@fam-test.local`;
    const hash = await AuthService.hashPassword('x-password-1');
    const u: any = await query(`INSERT INTO users (email, password_hash, name, role, is_verified) VALUES (?, ?, ?, 'PATIENT', TRUE)`, [email, hash, name]);
    await query(`INSERT INTO patients (user_id, date_of_birth, gender, address) VALUES (?, '1990-01-01', 'MALE', 'x')`, [u.insertId]);
    return { id: u.insertId as number, email };
}

const invite = async (from: number, email: string, relationship = 'SPOUSE') => {
    await as('PATIENT', from);
    const { POST } = await import('@/app/api/patient/family/route');
    return POST(post('/api/patient/family', { email, relationship }));
};
const respond = async (as_: number, requestId: number, action: 'ACCEPT' | 'REJECT') => {
    await as('PATIENT', as_);
    const { POST } = await import('@/app/api/patient/family/respond/route');
    return POST(post('/api/patient/family/respond', { requestId, action }));
};
const requestRow = (a: number, b: number) =>
    one(`SELECT * FROM patient_family_links WHERE requester_id = ? AND member_id = ?`, [a, b]);

beforeEach(() => { vi.mocked(EmailService.sendEmail).mockReset().mockResolvedValue({} as any); });

describe('family invitations', () => {
    it('invite -> accept creates one bidirectional link', async () => {
        const a = await newPatient(), b = await newPatient();
        expect((await invite(a.id, b.email, 'SIBLING')).status).toBe(200);
        const req = await requestRow(a.id, b.id);
        expect(req.status).toBe('PENDING');
        expect((await respond(b.id, req.id, 'ACCEPT')).status).toBe(200);
        expect((await requestRow(a.id, b.id)).status).toBe('APPROVED');
        const links = await rows(`SELECT relationship FROM family_links WHERE (primary_patient_id = ? AND linked_patient_id = ?) OR (primary_patient_id = ? AND linked_patient_id = ?)`, [a.id, b.id, b.id, a.id]);
        expect(links).toEqual([{ relationship: 'SIBLING' }]);

        // both sides see each other in the family list
        const { GET } = await import('@/app/api/patient/family/route');
        for (const [me, other] of [[a.id, b.id], [b.id, a.id]]) {
            await as('PATIENT', me);
            const body = await (await GET()).json();
            expect(body.linked_members.map((m: any) => m.member_id)).toEqual([other]);
        }
    });

    it('rejects bad input without touching the database', async () => {
        const a = await newPatient();
        for (const body of [{}, { email: 'nope', relationship: 'SPOUSE' }, { email: a.email, relationship: 'ROBOT' }]) {
            await as('PATIENT', a.id);
            const { POST } = await import('@/app/api/patient/family/route');
            expect((await POST(post('/x', body))).status).toBe(400);
        }
    });

    it('cannot invite yourself, a stranger, or a non-patient', async () => {
        const a = await newPatient();
        expect((await invite(a.id, a.email)).status).toBe(400);
        expect((await invite(a.id, 'nobody@fam-test.local')).status).toBe(404);
        expect((await invite(a.id, 'doc.smith@sethro.com')).status).toBe(404);
    });

    it('blocks duplicates, including a request coming the other way', async () => {
        const a = await newPatient(), b = await newPatient();
        await invite(a.id, b.email);
        expect((await invite(a.id, b.email)).status).toBe(409);
        const reverse = await invite(b.id, a.email);
        expect(reverse.status).toBe(409);
        expect((await reverse.json()).message).toMatch(/already sent you/i);
    });

    it('can re-invite after a rejection (the old row is reused, no server error)', async () => {
        const a = await newPatient(), b = await newPatient();
        await invite(a.id, b.email, 'SPOUSE');
        const first = await requestRow(a.id, b.id);
        expect((await respond(b.id, first.id, 'REJECT')).status).toBe(200);
        expect((await invite(a.id, b.email, 'PARENT')).status).toBe(200);
        expect(await requestRow(a.id, b.id)).toMatchObject({ id: first.id, status: 'PENDING', relationship: 'PARENT' });
    });

    it('only the invited person can answer, and only once', async () => {
        const a = await newPatient(), b = await newPatient(), c = await newPatient();
        await invite(a.id, b.email);
        const req = await requestRow(a.id, b.id);
        expect((await respond(a.id, req.id, 'ACCEPT')).status).toBe(403);   // the requester cannot approve themselves
        expect((await respond(c.id, req.id, 'ACCEPT')).status).toBe(403);   // nor a bystander
        expect((await respond(b.id, req.id, 'ACCEPT')).status).toBe(200);
        expect((await respond(b.id, req.id, 'ACCEPT')).status).toBe(409);
        expect((await respond(b.id, 999999, 'ACCEPT')).status).toBe(404);
        expect(await rows(`SELECT id FROM family_links WHERE primary_patient_id = ? OR linked_patient_id = ?`, [b.id, b.id])).toHaveLength(1);
    });

    it('simultaneous accepts create exactly one link', async () => {
        const a = await newPatient(), b = await newPatient();
        await invite(a.id, b.email);
        const req = await requestRow(a.id, b.id);
        const { POST } = await import('@/app/api/patient/family/respond/route');
        const token = await tokenFor('PATIENT', b.id);
        const res = await Promise.all(Array.from({ length: 4 }, () => identity.run(token, () => POST(post('/x', { requestId: req.id, action: 'ACCEPT' })))));
        const codes = res.map((r) => r.status).sort();
        expect(codes.filter((c) => c === 200)).toHaveLength(1);
        expect(codes.filter((c) => c >= 500)).toHaveLength(0);
        expect(await rows(`SELECT id FROM family_links WHERE primary_patient_id = ? OR linked_patient_id = ?`, [b.id, b.id])).toHaveLength(1);
    });

    it('accepting when reception already linked them does not fail', async () => {
        const a = await newPatient(), b = await newPatient();
        await invite(a.id, b.email);
        await query(`INSERT INTO family_links (primary_patient_id, linked_patient_id, relationship) VALUES (?, ?, 'OTHER')`, [b.id, a.id]);
        const req = await requestRow(a.id, b.id);
        expect((await respond(b.id, req.id, 'ACCEPT')).status).toBe(200);
    });

    it('escapes the inviter\'s name in the email', async () => {
        const a = await newPatient('<img src=x onerror=alert(1)>'), b = await newPatient();
        await invite(a.id, b.email);
        const html = vi.mocked(EmailService.sendEmail).mock.calls[0][2] as string;
        expect(html).not.toContain('<img');
        expect(html).toContain('&lt;img');
    });

    it('a patient can switch into a linked account but not an unlinked one', async () => {
        const a = await newPatient(), b = await newPatient(), c = await newPatient();
        await query(`INSERT INTO family_links (primary_patient_id, linked_patient_id, relationship) VALUES (?, ?, 'CHILD')`, [a.id, b.id]);
        const { POST } = await import('@/app/api/auth/switch-account/route');
        await as('PATIENT', a.id);
        expect((await POST(post('/x', { target_user_id: b.id }))).status).toBe(200);
        await as('PATIENT', a.id);
        expect((await POST(post('/x', { target_user_id: c.id }))).status).toBe(403);
    });
});

describe('reception: linking patients', () => {
    const link = async (body: unknown) => {
        await as('RECEPTIONIST', RECEPTIONIST);
        const { POST } = await import('@/app/api/receptionist/patients/link/route');
        return POST(post('/x', body));
    };

    it('links two patients once, in either direction', async () => {
        const a = await newPatient(), b = await newPatient();
        expect((await link({ primary_patient_id: a.id, linked_patient_id: b.id, relationship: 'PARENT' })).status).toBe(200);
        expect((await link({ primary_patient_id: a.id, linked_patient_id: b.id, relationship: 'PARENT' })).status).toBe(409);
        expect((await link({ primary_patient_id: b.id, linked_patient_id: a.id, relationship: 'CHILD' })).status).toBe(409);
    });

    it('rejects self-links (even with string ids), non-patients, unknown ids and bad relationships', async () => {
        const a = await newPatient(), b = await newPatient();
        expect((await link({ primary_patient_id: a.id, linked_patient_id: String(a.id), relationship: 'OTHER' })).status).toBe(400);
        expect((await link({ primary_patient_id: a.id, linked_patient_id: DOCTOR, relationship: 'OTHER' })).status).toBe(404);
        expect((await link({ primary_patient_id: a.id, linked_patient_id: 999999, relationship: 'OTHER' })).status).toBe(404);
        expect((await link({ primary_patient_id: a.id, linked_patient_id: b.id, relationship: 'ENEMY' })).status).toBe(400);
        expect((await link({})).status).toBe(400);
    });
});

describe('reception: registering a walk-in patient', () => {
    const register = async (over: Record<string, unknown> = {}) => {
        await as('RECEPTIONIST', RECEPTIONIST);
        const { POST } = await import('@/app/api/receptionist/patients/route');
        return POST(post('/x', {
            name: 'Walk In', email: `walk.${Date.now()}.${n++}@fam-test.local`, phone: '0771234567',
            date_of_birth: '1985-05-05', gender: 'MALE', address: '1 Main St', ...over,
        }));
    };

    it('creates a verified patient that can sign in with the one-time password', async () => {
        const email = `walk.${Date.now()}.${n++}@fam-test.local`;
        const res = await register({ email });
        expect(res.status).toBe(200);
        const { temporaryPassword, userId } = await res.json();
        expect(temporaryPassword).toMatch(/^[A-Za-z0-9]{10}$/);
        expect(temporaryPassword).not.toContain('0771234567');
        expect(await one(`SELECT is_verified, role FROM users WHERE id = ?`, [userId])).toMatchObject({ is_verified: 1, role: 'PATIENT' });
        await query('DELETE FROM rate_limits');
        const { POST } = await import('@/app/api/auth/login/route');
        const login = await POST(post('/x', { email, password: temporaryPassword }));
        expect(login.status).toBe(200);
    });

    it('generates a different password every time and never reuses the phone number', async () => {
        const a = (await (await register()).json()).temporaryPassword;
        const b = (await (await register()).json()).temporaryPassword;
        expect(a).not.toBe(b);
    });

    it('works without a phone number', async () => {
        const res = await register({ phone: undefined });
        expect(res.status).toBe(200);
    });

    it.each([
        ['duplicate email', { email: 'patient.alice@gmail.com' }, 409],
        ['bad email', { email: 'x' }, 400],
        ['future DOB', { date_of_birth: '2999-01-01' }, 400],
        ['impossible DOB', { date_of_birth: '1990-02-31' }, 400],
        ['bad gender', { gender: 'ROBOT' }, 400],
        ['missing address', { address: '' }, 400],
        ['short name', { name: 'A' }, 400],
    ])('rejects %s', async (_l, over, status) => {
        expect((await register(over)).status).toBe(status);
    });

    it('searches patients, treating % and _ literally', async () => {
        const marker = `Zq${Date.now()}`;
        const a = await newPatient(marker + 'Alpha');
        const { GET } = await import('@/app/api/receptionist/patients/route');
        await as('RECEPTIONIST', RECEPTIONIST);
        const found: any[] = await (await GET(new Request('http://x/api/receptionist/patients?q=' + marker))).json();
        expect(found.map((p) => p.id)).toContain(a.id);
        const wild: any[] = await (await GET(new Request('http://x/api/receptionist/patients?q=%25'))).json();
        expect(wild).toHaveLength(0);                        // a literal "%" matches no name/phone/email
        const under: any[] = await (await GET(new Request('http://x/api/receptionist/patients?q=_'))).json();
        expect(under.every((p) => /_/.test(`${p.name}${p.phone}${p.email}`))).toBe(true);
    });
});

describe('reception: bookings and status changes', () => {
    const book = async (body: Record<string, unknown>) => {
        await as('RECEPTIONIST', RECEPTIONIST);
        const { POST } = await import('@/app/api/receptionist/appointments/create/route');
        return POST(post('/x', { patient_id: ALICE, doctor_id: DOCTOR, date: isoDate(70), time_slot: '09:00', ...body }));
    };
    const setStatus = async (id: number | string, status: unknown) => {
        await as('RECEPTIONIST', RECEPTIONIST);
        const { PUT } = await import('@/app/api/receptionist/appointments/[id]/status/route');
        return PUT(post('/x', { status }, 'PUT'), ctx(id));
    };

    it('uses the same rules as patient booking: past date, bad slot, leave day, double booking', async () => {
        expect((await book({ date: isoDate(-1) })).status).toBe(400);
        expect((await book({ time_slot: '9am' })).status).toBe(400);
        expect((await book({ doctor_id: 999999 })).status).toBe(404);
        expect((await book({ patient_id: DOCTOR })).status).toBe(404);   // staff are not patients
        await query(`INSERT INTO doctor_leaves (doctor_id, date) VALUES (?, ?)`, [DOCTOR, isoDate(71)]);
        expect((await book({ date: isoDate(71) })).status).toBe(409);
        expect((await book({ date: isoDate(72), time_slot: '10:00' })).status).toBe(200);
        expect((await book({ date: isoDate(72), time_slot: '10:00', patient_id: BOB })).status).toBe(409);
    });

    it('stores the reason and gives sequential queue numbers', async () => {
        const date = isoDate(73);
        const first = await (await book({ date, time_slot: '09:00', reason: 'Cough' })).json();
        const second = await (await book({ date, time_slot: '09:15', patient_id: BOB })).json();
        expect([first.queue_number, second.queue_number]).toEqual([1, 2]);
        expect((await one(`SELECT reason FROM appointments WHERE id = ?`, [first.appointmentId])).reason).toBe('Cough');
    });

    it('a cancelled slot can be booked again', async () => {
        const date = isoDate(74);
        const first = await (await book({ date, time_slot: '11:00' })).json();
        expect((await setStatus(first.appointmentId, 'CANCELLED')).status).toBe(200);
        expect((await book({ date, time_slot: '11:00', patient_id: BOB })).status).toBe(200);
    });

    it('allows the sensible transitions', async () => {
        const a = await makeAppointment();
        expect((await setStatus(a, 'CHECKED_IN')).status).toBe(200);
        expect((await setStatus(a, 'NO_SHOW')).status).toBe(200);
        const b = await makeAppointment();
        expect((await setStatus(b, 'ABSENT')).status).toBe(200);
        const c = await makeAppointment(ALICE, 'CHECKED_IN');
        expect((await setStatus(c, 'CANCELLED')).status).toBe(200);
    });

    it('refuses nonsense transitions and leaves the appointment alone', async () => {
        const done = await makeAppointment(ALICE, 'COMPLETED');
        const ongoing = await makeAppointment(ALICE, 'ONGOING');
        const cancelled = await makeAppointment(ALICE, 'CANCELLED');
        expect((await setStatus(done, 'CANCELLED')).status).toBe(409);
        expect((await setStatus(ongoing, 'CHECKED_IN')).status).toBe(409);
        expect((await setStatus(cancelled, 'CHECKED_IN')).status).toBe(409);   // cannot revive
        expect((await setStatus(done, 'CHECKED_IN')).status).toBe(409);
        expect((await one(`SELECT status FROM appointments WHERE id = ?`, [done])).status).toBe('COMPLETED');
        expect((await one(`SELECT status FROM appointments WHERE id = ?`, [cancelled])).status).toBe('CANCELLED');
    });

    it('validates the id and status values', async () => {
        const a = await makeAppointment();
        expect((await setStatus(a, 'COMPLETED')).status).toBe(400);   // only the doctor/payment flow completes
        expect((await setStatus(a, 'ONGOING')).status).toBe(400);
        expect((await setStatus(a, 'bogus')).status).toBe(400);
        expect((await setStatus(a, undefined)).status).toBe(400);
        expect((await setStatus('abc', 'CHECKED_IN')).status).toBe(400);
        expect((await setStatus(999999, 'CHECKED_IN')).status).toBe(404);
    });
});
