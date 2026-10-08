import { describe, it, expect, afterAll } from 'vitest';
import { pool, query } from '@/lib/db';
import { ALICE, BOB, DOCTOR, PHARMACIST, RECEPTIONIST, as, post, ctx, isoDate, one, rows, makeAppointment, addMedicine, consult, dispense, rx } from './helpers';

// Plan section 10: in-app notifications (nothing is emailed or texted).
const LAB = 7;
afterAll(async () => { await pool.end(); });

const maxId = async () => Number((await one(`SELECT COALESCE(MAX(id), 0) AS m FROM notifications`)).m);
/** Notifications created for a user after `mark`. */
const since = (userId: number, mark: number) =>
    rows(`SELECT id, type, title, body, link, is_read AS isRead FROM notifications WHERE user_id = ? AND id > ? ORDER BY id`, [userId, mark]);
const types = async (userId: number, mark: number) => (await since(userId, mark)).map((n: any) => n.type);

const api = {
    list: async (role: Parameters<typeof as>[0], id: number, qs = '') => {
        await as(role, id);
        const { GET } = await import('@/app/api/notifications/route');
        return GET(new Request('http://x/api/notifications' + qs));
    },
    read: async (role: Parameters<typeof as>[0], id: number, body: unknown) => {
        await as(role, id);
        const { POST } = await import('@/app/api/notifications/read/route');
        return POST(post('/x', body));
    },
};

async function seedFor(userId: number, count: number, over: Record<string, unknown> = {}) {
    const ids: number[] = [];
    for (let i = 0; i < count; i++) {
        const r: any = await query(`INSERT INTO notifications (user_id, type, title, body, link, is_read) VALUES (?, 'TEST', ?, 'body', NULL, ?)`,
            [userId, `n${i}`, over.is_read ? 1 : 0]);
        ids.push(r.insertId);
    }
    return ids;
}

describe('notification API', () => {
    it('requires a session', async () => {
        const { state } = await import('../helpers/state');
        state.token = null;
        const { GET } = await import('@/app/api/notifications/route');
        const { POST } = await import('@/app/api/notifications/read/route');
        expect((await GET(new Request('http://x'))).status).toBe(401);
        expect((await POST(post('/x', { all: true }))).status).toBe(401);
    });

    it('every role can read its own list', async () => {
        for (const [role, id] of [['PATIENT', ALICE], ['DOCTOR', DOCTOR], ['PHARMACIST', PHARMACIST], ['LAB_ASSISTANT', LAB], ['RECEPTIONIST', RECEPTIONIST], ['ADMIN', 1]] as const) {
            expect((await api.list(role, id)).status, role).toBe(200);
        }
    });

    it('returns only the caller\'s notifications, newest first, with an unread count', async () => {
        const mark = await maxId();
        const mine = await seedFor(ALICE, 3);
        await seedFor(BOB, 2);
        const body = await (await api.list('PATIENT', ALICE, '?limit=100')).json();
        const ids = body.notifications.filter((n: any) => n.id > mark).map((n: any) => n.id);
        expect(ids).toEqual([...mine].reverse());
        expect(body.notifications.every((n: any) => typeof n.isRead === 'boolean')).toBe(true);
        const bobs = await (await api.list('PATIENT', BOB, '?limit=100')).json();
        expect(bobs.notifications.some((n: any) => mine.includes(n.id))).toBe(false);
    });

    it('countOnly, unread filter, limit and paging', async () => {
        await query(`DELETE FROM notifications WHERE user_id = ?`, [BOB]);
        const ids = await seedFor(BOB, 5);
        await query(`UPDATE notifications SET is_read = TRUE WHERE id = ?`, [ids[0]]);
        expect(await (await api.list('PATIENT', BOB, '?countOnly=1')).json()).toEqual({ unreadCount: 4 });
        const unread = await (await api.list('PATIENT', BOB, '?unread=1&limit=100')).json();
        expect(unread.notifications).toHaveLength(4);
        const page1 = await (await api.list('PATIENT', BOB, '?limit=2')).json();
        expect(page1.notifications.map((n: any) => n.id)).toEqual([ids[4], ids[3]]);
        const page2 = await (await api.list('PATIENT', BOB, `?limit=2&before=${ids[3]}`)).json();
        expect(page2.notifications.map((n: any) => n.id)).toEqual([ids[2], ids[1]]);
        // silly limits are clamped rather than rejected
        expect((await (await api.list('PATIENT', BOB, '?limit=100000')).json()).notifications.length).toBeLessThanOrEqual(100);
        expect((await api.list('PATIENT', BOB, '?limit=abc')).status).toBe(200);
        expect((await api.list('PATIENT', BOB, '?limit=-3')).status).toBe(200);
    });

    it('marks chosen notifications read, and cannot touch anyone else\'s', async () => {
        await query(`DELETE FROM notifications WHERE user_id IN (?, ?)`, [ALICE, BOB]);
        const [a1, a2] = await seedFor(ALICE, 2);
        const [b1] = await seedFor(BOB, 1);
        const res = await api.read('PATIENT', ALICE, { ids: [a1, b1] });     // b1 belongs to Bob
        expect((await res.json()).unreadCount).toBe(1);
        expect((await one(`SELECT is_read FROM notifications WHERE id = ?`, [a1])).is_read).toBe(1);
        expect((await one(`SELECT is_read FROM notifications WHERE id = ?`, [a2])).is_read).toBe(0);
        expect((await one(`SELECT is_read FROM notifications WHERE id = ?`, [b1])).is_read).toBe(0);   // untouched
    });

    it('marks everything read in one go', async () => {
        await query(`DELETE FROM notifications WHERE user_id = ?`, [ALICE]);
        await seedFor(ALICE, 4);
        expect((await (await api.read('PATIENT', ALICE, { all: true })).json()).unreadCount).toBe(0);
    });

    it.each([[{}], [{ ids: [] }], [{ ids: ['a'] }], [{ ids: [-1] }], [{ all: false }], [{ ids: Array.from({ length: 201 }, (_, i) => i + 1) }]])(
        'rejects bad body %j', async (body) => {
            expect((await api.read('PATIENT', ALICE, body)).status).toBe(400);
        });

    it('purges read notifications older than 90 days, keeps unread ones', async () => {
        await query(`DELETE FROM notifications WHERE user_id = ?`, [ALICE]);
        const [oldRead, oldUnread, fresh] = await seedFor(ALICE, 3);
        await query(`UPDATE notifications SET is_read = TRUE, created_at = NOW() - INTERVAL 100 DAY WHERE id = ?`, [oldRead]);
        await query(`UPDATE notifications SET created_at = NOW() - INTERVAL 100 DAY WHERE id = ?`, [oldUnread]);
        await api.read('PATIENT', ALICE, { ids: [fresh] });
        expect(await rows(`SELECT id FROM notifications WHERE id = ?`, [oldRead])).toHaveLength(0);
        expect(await rows(`SELECT id FROM notifications WHERE id = ?`, [oldUnread])).toHaveLength(1);
        expect(await rows(`SELECT id FROM notifications WHERE id = ?`, [fresh])).toHaveLength(1);
    });

    it('notifications go when their user is deleted', async () => {
        const hash = 'x';
        const u: any = await query(`INSERT INTO users (email, password_hash, name, role, is_verified) VALUES (?, ?, 'Temp', 'PATIENT', TRUE)`, [`tmp.${Date.now()}@n-test.local`, hash]);
        await seedFor(u.insertId, 2);
        await query(`DELETE FROM users WHERE id = ?`, [u.insertId]);
        expect(await rows(`SELECT id FROM notifications WHERE user_id = ?`, [u.insertId])).toHaveLength(0);
    });
});

describe('booking and cancelling', () => {
    const patientBooks = async (patientId: number, date: string, timeSlot: string) => {
        await as('PATIENT', patientId);
        const { POST } = await import('@/app/api/appointments/route');
        return POST(post('/x', { patientId, doctorId: DOCTOR, date, timeSlot }));
    };

    it('a patient booking notifies the doctor (with the patient name) but not themselves', async () => {
        const mark = await maxId();
        expect((await patientBooks(ALICE, isoDate(100), '09:00')).status).toBe(201);
        const doc = await since(DOCTOR, mark);
        expect(doc).toHaveLength(1);
        expect(doc[0]).toMatchObject({ type: 'APPOINTMENT_BOOKED', link: '/doctor/appointments' });
        expect(doc[0].body).toContain('Alice Cooper');
        expect(await since(ALICE, mark)).toHaveLength(0);
        expect(await since(BOB, mark)).toHaveLength(0);
        expect(await since(RECEPTIONIST, mark)).toHaveLength(0);
    });

    it('a booking made by the front desk notifies both the doctor and the patient', async () => {
        const mark = await maxId();
        await as('RECEPTIONIST', RECEPTIONIST);
        const { POST } = await import('@/app/api/receptionist/appointments/create/route');
        expect((await POST(post('/x', { patient_id: BOB, doctor_id: DOCTOR, date: isoDate(100), time_slot: '09:15' }))).status).toBe(200);
        expect(await types(DOCTOR, mark)).toEqual(['APPOINTMENT_BOOKED']);
        const patient = await since(BOB, mark);
        expect(patient).toHaveLength(1);
        expect(patient[0].link).toBe('/patient/appointments');
        expect(await since(RECEPTIONIST, mark)).toHaveLength(0);
    });

    it('a failed booking sends nothing (the slot was taken)', async () => {
        await patientBooks(ALICE, isoDate(101), '09:00');
        const mark = await maxId();
        expect((await patientBooks(BOB, isoDate(101), '09:00')).status).toBe(409);
        expect(await maxId()).toBe(mark);
    });

    it('a patient cancelling tells the doctor, not themselves', async () => {
        const appt = await makeAppointment(ALICE);
        const mark = await maxId();
        await as('PATIENT', ALICE);
        const { PUT } = await import('@/app/api/appointments/cancel/route');
        expect((await PUT(post('/x', { appointmentId: appt }, 'PUT'))).status).toBe(200);
        expect(await types(DOCTOR, mark)).toEqual(['APPOINTMENT_CANCELLED']);
        expect(await since(ALICE, mark)).toHaveLength(0);
    });

    it('the front desk cancelling tells the doctor and the patient', async () => {
        const appt = await makeAppointment(BOB);
        const mark = await maxId();
        await as('RECEPTIONIST', RECEPTIONIST);
        const { PUT } = await import('@/app/api/receptionist/appointments/[id]/status/route');
        expect((await PUT(post('/x', { status: 'CANCELLED' }, 'PUT'), ctx(appt))).status).toBe(200);
        expect(await types(DOCTOR, mark)).toEqual(['APPOINTMENT_CANCELLED']);
        expect(await types(BOB, mark)).toEqual(['APPOINTMENT_CANCELLED']);
    });

    it('check-in tells the doctor; a refused change tells nobody', async () => {
        const appt = await makeAppointment(ALICE);
        const mark = await maxId();
        await as('RECEPTIONIST', RECEPTIONIST);
        const { PUT } = await import('@/app/api/receptionist/appointments/[id]/status/route');
        await PUT(post('/x', { status: 'CHECKED_IN' }, 'PUT'), ctx(appt));
        const doc = await since(DOCTOR, mark);
        expect(doc.map((n: any) => n.type)).toEqual(['PATIENT_CHECKED_IN']);
        expect(doc[0].body).toContain('Alice Cooper');

        const done = await makeAppointment(ALICE, 'COMPLETED');
        const mark2 = await maxId();
        expect((await PUT(post('/x', { status: 'CANCELLED' }, 'PUT'), ctx(done))).status).toBe(409);
        expect(await maxId()).toBe(mark2);
    });
});

describe('doctor leave', () => {
    it('warns the booked patients and the front desk, and nobody when no one is booked', async () => {
        const date = isoDate(110);
        await query(`INSERT INTO appointments (patient_id, doctor_id, date, time_slot, queue_number, status) VALUES (?, 3, ?, '10:00', 1, 'PENDING')`, [ALICE, date]);
        const mark = await maxId();
        await as('DOCTOR', 3);
        const { POST } = await import('@/app/api/doctor/profile/leaves/route');
        expect((await POST(post('/x', { date }))).status).toBe(201);
        expect(await types(ALICE, mark)).toEqual(['DOCTOR_LEAVE']);
        expect((await since(ALICE, mark))[0].body).not.toMatch(/Dr\.\s+Dr\./);      // names already carry the title
        expect((await since(ALICE, mark))[0].body).toContain('Dr. Jane Doe');
        expect(await types(RECEPTIONIST, mark)).toEqual(['DOCTOR_LEAVE']);
        expect(await since(BOB, mark)).toHaveLength(0);        // not booked that day

        const mark2 = await maxId();
        expect((await POST(post('/x', { date: isoDate(111) }))).status).toBe(201);
        expect(await maxId()).toBe(mark2);
    });
});

describe('consultation', () => {
    it('prescription and lab requests reach the pharmacy, the lab and the patient; completing sends the bill', async () => {
        const med = await addMedicine(`Notimed-${Date.now()}`, [{ qty: 50, expiryDays: 200, sell: 2 }]);
        const appt = await makeAppointment(ALICE);
        const mark = await maxId();
        expect((await consult(appt, { status: 'ONGOING', prescription: rx(med, 5), labRequestIds: [1, 2] })).status).toBe(200);

        expect(await types(PHARMACIST, mark)).toEqual(['PRESCRIPTION_ISSUED']);
        expect((await since(PHARMACIST, mark))[0].body).toContain('Alice Cooper');
        expect(await types(LAB, mark)).toEqual(['LAB_REQUESTED']);
        expect((await since(LAB, mark))[0].body).toMatch(/2 lab tests/);
        expect((await types(ALICE, mark)).sort()).toEqual(['LAB_REQUESTED', 'PRESCRIPTION_ISSUED']);
        expect(await since(RECEPTIONIST, mark)).toHaveLength(0);   // no bill until completion

        const mark2 = await maxId();
        await consult(appt, { status: 'COMPLETED', prescription: rx(med, 5), labRequestIds: [1, 2] });
        expect(await types(ALICE, mark2)).toEqual(['CONSULTATION_COMPLETED']);
        expect(await types(RECEPTIONIST, mark2)).toEqual(['BILL_READY']);
        expect(await since(PHARMACIST, mark2)).toHaveLength(0);     // nothing new for them
        expect(await since(LAB, mark2)).toHaveLength(0);
    });

    it('saving the same consultation again does not repeat any notification', async () => {
        const med = await addMedicine(`Repeat-${Date.now()}`, [{ qty: 50, expiryDays: 200, sell: 2 }]);
        const appt = await makeAppointment(ALICE);
        await consult(appt, { status: 'COMPLETED', prescription: rx(med, 5), labRequestIds: [1] });
        const mark = await maxId();
        await consult(appt, { status: 'COMPLETED', prescription: rx(med, 5), labRequestIds: [1] });
        expect(await maxId()).toBe(mark);
    });

    it('adding a medicine later tells the pharmacy again, but not the patient a second "issued" message', async () => {
        const a = await addMedicine(`First-${Date.now()}`, [{ qty: 50, expiryDays: 200, sell: 2 }]);
        const b = await addMedicine(`Second-${Date.now()}`, [{ qty: 50, expiryDays: 200, sell: 2 }]);
        const appt = await makeAppointment(ALICE);
        await consult(appt, { status: 'ONGOING', prescription: rx(a, 5) });
        const mark = await maxId();
        await consult(appt, { status: 'ONGOING', prescription: [...rx(a, 5), ...rx(b, 5)] });
        expect(await types(PHARMACIST, mark)).toEqual(['PRESCRIPTION_ISSUED']);
        expect(await since(ALICE, mark)).toHaveLength(0);
    });

    it('a save that fails part-way leaves no notifications behind', async () => {
        const appt = await makeAppointment(ALICE);
        const mark = await maxId();
        const res = await consult(appt, { status: 'COMPLETED', prescription: rx(999999, 1), labRequestIds: [1] });
        expect(res.status).toBe(400);
        expect(await maxId()).toBe(mark);
    });

    it('patient-facing messages never contain another patient\'s name', async () => {
        const appt = await makeAppointment(BOB);
        const mark = await maxId();
        await consult(appt, { status: 'COMPLETED', labRequestIds: [1] });
        for (const n of await since(BOB, mark)) {
            expect(`${n.title} ${n.body}`).not.toMatch(/Alice/);
        }
        expect(await since(ALICE, mark)).toHaveLength(0);
    });
});

describe('lab results and dispensing', () => {
    it('an uploaded lab result tells the doctor and the patient', async () => {
        const appt = await makeAppointment(ALICE, 'COMPLETED');
        const r: any = await query(`INSERT INTO lab_requests (appointment_id, test_id) VALUES (?, 1)`, [appt]);
        const mark = await maxId();
        await as('LAB_ASSISTANT', LAB);
        const { POST } = await import('@/app/api/lab-assistant/upload/route');
        const fd = new FormData();
        fd.append('file', new Blob([new Uint8Array(Buffer.from('%PDF-1.4 test'))]), 'r.pdf');
        fd.append('requestId', String(r.insertId));
        expect((await POST(new Request('http://x', { method: 'POST', body: fd }))).status).toBe(200);
        expect(await types(DOCTOR, mark)).toEqual(['LAB_RESULT']);
        const patient = await since(ALICE, mark);
        expect(patient.map((n: any) => n.type)).toEqual(['LAB_RESULT']);
        expect(patient[0].link).toBe('/patient/labs');
        expect(await since(BOB, mark)).toHaveLength(0);

        // a refused upload tells nobody
        const mark2 = await maxId();
        const fd2 = new FormData();
        fd2.append('file', new Blob([new Uint8Array(Buffer.from('%PDF-1.4 again'))]), 'r.pdf');
        fd2.append('requestId', String(r.insertId));
        expect((await POST(new Request('http://x', { method: 'POST', body: fd2 }))).status).toBe(409);
        expect(await maxId()).toBe(mark2);
    });

    async function rxFor(med: number, qty: number, patient = ALICE) {
        const appt = await makeAppointment(patient);
        await consult(appt, { status: 'ONGOING', prescription: rx(med, qty) });
        const p = await one(`SELECT id FROM prescriptions WHERE appointment_id = ?`, [appt]);
        const item = await one(`SELECT id FROM prescription_items WHERE prescription_id = ?`, [p.id]);
        return { pid: p.id as number, iid: item.id as number };
    }

    it('finishing a prescription tells the patient once; a partial dispense does not', async () => {
        const med = await addMedicine(`Ready-${Date.now()}`, [{ qty: 100, expiryDays: 200, sell: 2 }]);
        const { pid, iid } = await rxFor(med, 10);
        let mark = await maxId();
        await dispense(pid, { action: 'DISPENSE', quantity_to_dispense: 4, item_id: iid });
        expect(await types(ALICE, mark)).toEqual([]);
        mark = await maxId();
        await dispense(pid, { action: 'DISPENSE', quantity_to_dispense: 6, item_id: iid });
        const n = await since(ALICE, mark);
        expect(n.map((x: any) => x.type)).toEqual(['PRESCRIPTION_DISPENSED']);
        expect(n[0].link).toBe('/patient/prescriptions');
    });

    it('rejecting a medicine tells the patient; a refused dispense tells nobody', async () => {
        const med = await addMedicine(`Reject-${Date.now()}`, [{ qty: 10, expiryDays: 200, sell: 2 }]);
        const { pid, iid } = await rxFor(med, 3);
        let mark = await maxId();
        await dispense(pid, { action: 'REJECT', reason: 'OUT_OF_STOCK', item_id: iid });
        expect(await types(ALICE, mark)).toEqual(['MEDICINE_UNAVAILABLE']);
        mark = await maxId();
        expect((await dispense(pid, { action: 'DISPENSE', quantity_to_dispense: 1, item_id: iid })).status).toBe(409);
        expect(await maxId()).toBe(mark);
    });

    it('the pharmacists are warned once when stock falls to the reorder level', async () => {
        const med = await addMedicine(`Scarce-${Date.now()}`, [{ qty: 12, expiryDays: 200, sell: 2 }]);
        await query(`UPDATE medicines SET min_stock_level = 10 WHERE id = ?`, [med]);
        const one_ = await rxFor(med, 1);
        const two = await rxFor(med, 1);
        const three = await rxFor(med, 5);
        let mark = await maxId();
        await dispense(one_.pid, { action: 'DISPENSE', quantity_to_dispense: 1, item_id: one_.iid });     // 12 -> 11: still above
        expect((await types(PHARMACIST, mark)).filter((t: string) => t === 'LOW_STOCK')).toEqual([]);
        mark = await maxId();
        await dispense(two.pid, { action: 'DISPENSE', quantity_to_dispense: 1, item_id: two.iid });       // 11 -> 10: crosses
        expect((await types(PHARMACIST, mark)).filter((t: string) => t === 'LOW_STOCK')).toEqual(['LOW_STOCK']);
        mark = await maxId();
        await dispense(three.pid, { action: 'DISPENSE', quantity_to_dispense: 5, item_id: three.iid });   // 10 -> 5: already low, no repeat
        expect((await types(PHARMACIST, mark)).filter((t: string) => t === 'LOW_STOCK')).toEqual([]);
    });
});

describe('family links', () => {
    it('an invitation notifies the invited person and the answer notifies the requester', async () => {
        await query(`DELETE FROM family_links WHERE primary_patient_id IN (?, ?) OR linked_patient_id IN (?, ?)`, [ALICE, BOB, ALICE, BOB]);
        await query(`DELETE FROM patient_family_links WHERE requester_id IN (?, ?) OR member_id IN (?, ?)`, [ALICE, BOB, ALICE, BOB]);
        const mark = await maxId();
        await as('PATIENT', ALICE);
        const { POST } = await import('@/app/api/patient/family/route');
        expect((await POST(post('/x', { email: 'patient.bob@gmail.com', relationship: 'SIBLING' }))).status).toBe(200);
        const invite = await since(BOB, mark);
        expect(invite.map((n: any) => n.type)).toEqual(['FAMILY_REQUEST']);
        expect(invite[0].body).toContain('Alice Cooper');
        expect(await since(ALICE, mark)).toHaveLength(0);

        const reqRow = await one(`SELECT id FROM patient_family_links WHERE requester_id = ? AND member_id = ?`, [ALICE, BOB]);
        const mark2 = await maxId();
        await as('PATIENT', BOB);
        const { POST: respond } = await import('@/app/api/patient/family/respond/route');
        expect((await respond(post('/x', { requestId: reqRow.id, action: 'ACCEPT' }))).status).toBe(200);
        const answer = await since(ALICE, mark2);
        expect(answer.map((n: any) => n.type)).toEqual(['FAMILY_RESPONSE']);
        expect(answer[0].title).toMatch(/accepted/i);
        expect(await since(BOB, mark2)).toHaveLength(0);
    });
});

describe('resilience', () => {
    it('a notification problem never breaks the action that triggered it', async () => {
        await query(`RENAME TABLE notifications TO notifications_offline`);
        try {
            await as('PATIENT', ALICE);
            const { POST } = await import('@/app/api/appointments/route');
            const res = await POST(post('/x', { patientId: ALICE, doctorId: DOCTOR, date: isoDate(120), timeSlot: '09:00' }));
            expect(res.status).toBe(201);
            const appt = await makeAppointment(ALICE);
            expect((await consult(appt, { status: 'COMPLETED', labRequestIds: [1] })).status).toBe(200);
            expect(await one(`SELECT id FROM bills WHERE appointment_id = ?`, [appt])).toBeTruthy();
        } finally {
            await query(`RENAME TABLE notifications_offline TO notifications`);
        }
    });
});
