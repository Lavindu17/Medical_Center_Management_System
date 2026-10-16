import { describe, it, expect, afterAll } from 'vitest';
import { pool, query } from '@/lib/db';
import { ALICE, BOB, DOCTOR, as, ctx, one, rows, post, makeAppointment, addMedicine, consult } from './helpers';

// Phase 2 of the consultation screen: instructions on prescription lines, priority and notes on lab orders,
// and the doctor's favourites, recent medicines and saved sets of tests.
afterAll(async () => { await pool.end(); });

const DOCTOR_TWO = 3;
const line = (medicineId: number, over: Record<string, unknown> = {}) => ({ medicineId, dosage: '1', frequency: '1-0-0-1', duration: '5 days', quantity: 10, ...over });
const open = async (appt: number) => {
    await as('DOCTOR', DOCTOR);
    const { GET } = await import('@/app/api/doctor/consultation/[id]/route');
    return (await GET(new Request('http://x'), ctx(appt))).json();
};
const presets = async (doctor = DOCTOR) => {
    await as('DOCTOR', doctor);
    return (await import('@/app/api/doctor/presets/route')).GET();
};
const send = async (body: unknown, doctor = DOCTOR) => {
    await as('DOCTOR', doctor);
    return (await import('@/app/api/doctor/presets/route')).POST(post('/x', body));
};
const remove = async (qs: string, doctor = DOCTOR) => {
    await as('DOCTOR', doctor);
    return (await import('@/app/api/doctor/presets/route')).DELETE(new Request(`http://x/api/doctor/presets?${qs}`, { method: 'DELETE' }));
};

describe('prescription line extras', () => {
    it('saves instructions, food timing and as-needed, and shows them when the visit is reopened', async () => {
        const med = await addMedicine(`Extras-${Date.now()}`, [{ qty: 50, expiryDays: 100, sell: 2 }]);
        const appt = await makeAppointment(ALICE);
        const res = await consult(appt, { status: 'ONGOING', prescription: [line(med, { instructions: 'Finish the course', foodTiming: 'AFTER', asNeeded: true })] });
        expect(res.status).toBe(200);
        const body = await open(appt);
        expect(body.features).toEqual({ rxExtras: true, labExtras: true });
        expect(body.current.prescription[0]).toMatchObject({ instructions: 'Finish the course', foodTiming: 'AFTER', asNeeded: true });
        // Editing the same line changes them
        await consult(appt, { status: 'ONGOING', prescription: [line(med, { instructions: null, foodTiming: 'BEFORE', asNeeded: false })] });
        expect((await open(appt)).current.prescription[0]).toMatchObject({ instructions: null, foodTiming: 'BEFORE', asNeeded: false });
    });

    it('lines without extras still save (older screens)', async () => {
        const med = await addMedicine(`Plain2-${Date.now()}`, [{ qty: 50, expiryDays: 100, sell: 2 }]);
        const appt = await makeAppointment(ALICE);
        expect((await consult(appt, { status: 'ONGOING', prescription: [line(med)] })).status).toBe(200);
        expect((await open(appt)).current.prescription[0]).toMatchObject({ instructions: null, foodTiming: null, asNeeded: false });
    });

    it.each([
        ['a food timing that does not exist', { foodTiming: 'DURING' }],
        ['instructions over 255 characters', { instructions: 'x'.repeat(256) }],
        ['as-needed that is not true or false', { asNeeded: 'yes' }],
    ])('rejects %s and saves nothing', async (_l, extra) => {
        const med = await addMedicine(`Bad-${Date.now()}`, [{ qty: 50, expiryDays: 100, sell: 2 }]);
        const appt = await makeAppointment(ALICE);
        expect((await consult(appt, { status: 'ONGOING', prescription: [line(med, extra)] })).status).toBe(400);
        expect((await open(appt)).current.prescription).toEqual([]);
    });

    it('the history carries the medicine id and the extras, so a past prescription can be repeated', async () => {
        const med = await addMedicine(`Repeat-${Date.now()}`, [{ qty: 50, expiryDays: 100, sell: 2 }]);
        const old = await makeAppointment(BOB);
        await consult(old, { status: 'COMPLETED', prescription: [line(med, { foodTiming: 'WITH' })] });
        const next = await makeAppointment(BOB);
        const past = (await open(next)).history.prescriptions.find((p: any) => p.medicineId === med);
        expect(past).toMatchObject({ medicineId: med, dosage: '1', frequency: '1-0-0-1', foodTiming: 'WITH', asNeeded: 0 });
    });
});

describe('lab orders with priority and notes', () => {
    const labs = (appt: number) => rows(`SELECT test_id AS testId, priority, clinical_note AS note FROM lab_requests WHERE appointment_id = ? ORDER BY test_id`, [appt]);

    it('saves priority and a clinical note, and returns them', async () => {
        const appt = await makeAppointment(ALICE);
        const res = await consult(appt, { status: 'ONGOING', labOrders: [{ testId: 1, priority: 'URGENT', note: 'Fasting sample' }, { testId: 2 }] });
        expect(res.status).toBe(200);
        expect(await labs(appt)).toEqual([{ testId: 1, priority: 'URGENT', note: 'Fasting sample' }, { testId: 2, priority: 'ROUTINE', note: null }]);
        const current = (await open(appt)).current.labs;
        expect(current.map((l: any) => [l.testId, l.priority, l.note])).toEqual([[1, 'URGENT', 'Fasting sample'], [2, 'ROUTINE', null]]);
    });

    it('a waiting request can be made more or less urgent; a finished one is not touched', async () => {
        const appt = await makeAppointment(ALICE);
        await consult(appt, { status: 'ONGOING', labOrders: [{ testId: 1 }, { testId: 2 }] });
        await query(`UPDATE lab_requests SET status = 'COMPLETED', completed_at = NOW() WHERE appointment_id = ? AND test_id = 1`, [appt]);
        await consult(appt, { status: 'ONGOING', labOrders: [{ testId: 1, priority: 'URGENT', note: 'late edit' }, { testId: 2, priority: 'URGENT', note: 'now urgent' }] });
        expect(await labs(appt)).toEqual([{ testId: 1, priority: 'ROUTINE', note: null }, { testId: 2, priority: 'URGENT', note: 'now urgent' }]);
    });

    it('the old list of ids still works and means routine', async () => {
        const appt = await makeAppointment(ALICE);
        expect((await consult(appt, { status: 'ONGOING', labRequestIds: [1] })).status).toBe(200);
        expect(await labs(appt)).toEqual([{ testId: 1, priority: 'ROUTINE', note: null }]);
    });

    it.each([
        ['an unknown priority', [{ testId: 1, priority: 'ASAP' }]],
        ['a note over 255 characters', [{ testId: 1, note: 'x'.repeat(256) }]],
        ['an order with no test', [{ priority: 'URGENT' }]],
        ['something that is not a list', 'x'],
    ])('rejects %s', async (_l, labOrders) => {
        const appt = await makeAppointment(ALICE);
        expect((await consult(appt, { status: 'ONGOING', labOrders })).status).toBe(400);
        expect(await labs(appt)).toHaveLength(0);
    });

    it('tells the lab when something is urgent', async () => {
        const mark = Number((await one(`SELECT COALESCE(MAX(id), 0) AS m FROM notifications`)).m);
        const appt = await makeAppointment(ALICE);
        await consult(appt, { status: 'ONGOING', labOrders: [{ testId: 1, priority: 'URGENT' }, { testId: 2 }] });
        const n = await rows(`SELECT title, body FROM notifications WHERE id > ? AND type = 'LAB_REQUESTED' AND user_id = 7`, [mark]);
        expect(n[0].title).toBe('Urgent lab request');
        expect(n[0].body).toContain('1 urgent');
    });

    it('the lab assistant sees priority and the note', async () => {
        const appt = await makeAppointment(ALICE);
        await consult(appt, { status: 'ONGOING', labOrders: [{ testId: 1, priority: 'URGENT', note: 'Check potassium' }] });
        await as('LAB_ASSISTANT', 7);
        const { GET } = await import('@/app/api/lab-assistant/requests/route');
        const mine = (await (await GET(new Request('http://x'))).json()).find((r: any) => r.appointment_id === appt || (r.clinical_note === 'Check potassium'));
        expect(mine).toMatchObject({ priority: 'URGENT', clinical_note: 'Check potassium' });
    });
});

describe('favourites', () => {
    it('saves a favourite line, replaces it for the same medicine, lists it and removes it', async () => {
        const med = await addMedicine(`Fav-${Date.now()}`, [{ qty: 50, expiryDays: 100, sell: 2 }]);
        const fav = { type: 'favourite', medicineId: med, dosage: '1', frequency: '1-0-0-1', duration: '5 days', foodTiming: 'AFTER' };
        expect((await send(fav)).status).toBe(201);
        expect((await send({ ...fav, duration: '1 week', instructions: 'Drink water', asNeeded: true })).status).toBe(201);
        const mine = (await (await presets()).json()).favourites.filter((f: any) => f.medicineId === med);
        expect(mine).toHaveLength(1);
        expect(mine[0]).toMatchObject({ duration: '1 week', instructions: 'Drink water', foodTiming: 'AFTER', asNeeded: true });
        expect((await remove(`type=favourite&medicineId=${med}`)).status).toBe(200);
        expect((await (await presets()).json()).favourites.some((f: any) => f.medicineId === med)).toBe(false);
        expect((await remove(`type=favourite&medicineId=${med}`)).status).toBe(404);
    });

    it('favourites belong to the doctor who saved them', async () => {
        const med = await addMedicine(`FavOwn-${Date.now()}`, [{ qty: 50, expiryDays: 100, sell: 2 }]);
        await send({ type: 'favourite', medicineId: med, dosage: '1', frequency: '1-0-0-0', duration: '3 days' });
        expect((await (await presets(DOCTOR_TWO)).json()).favourites.some((f: any) => f.medicineId === med)).toBe(false);
        expect((await remove(`type=favourite&medicineId=${med}`, DOCTOR_TWO)).status).toBe(404);
        expect((await (await presets()).json()).favourites.some((f: any) => f.medicineId === med)).toBe(true);
    });

    it.each([
        ['an unknown medicine', { medicineId: 999999, dosage: '1', frequency: '1-0-0-0', duration: '3 days' }, 404],
        ['a missing dosage', { medicineId: 1, frequency: '1-0-0-0', duration: '3 days' }, 400],
        ['a bad food timing', { medicineId: 1, dosage: '1', frequency: '1-0-0-0', duration: '3 days', foodTiming: 'X' }, 400],
        ['no medicine', { dosage: '1', frequency: '1-0-0-0', duration: '3 days' }, 400],
    ])('rejects %s', async (_l, extra, status) => {
        expect((await send({ type: 'favourite', ...extra })).status).toBe(status);
    });
});

describe('saved sets of lab tests', () => {
    it('saves a set, replaces one with the same name, lists it with its tests and removes it', async () => {
        const name = `Fever ${Date.now()}`;
        const first = await (await send({ type: 'panel', name, testIds: [1, 2] })).json();
        const again = await (await send({ type: 'panel', name, testIds: [2, 3, 3] })).json();
        expect(again.id).toBe(first.id);
        const panel = (await (await presets()).json()).panels.find((p: any) => p.name === name);
        expect(panel.testIds).toEqual([2, 3]);
        expect((await remove(`type=panel&id=${first.id}`)).status).toBe(200);
        expect((await remove(`type=panel&id=${first.id}`)).status).toBe(404);
    });

    it('is private to the doctor', async () => {
        const name = `Private ${Date.now()}`;
        const id = (await (await send({ type: 'panel', name, testIds: [1] })).json()).id;
        expect((await (await presets(DOCTOR_TWO)).json()).panels.some((p: any) => p.name === name)).toBe(false);
        expect((await remove(`type=panel&id=${id}`, DOCTOR_TWO)).status).toBe(404);
        await remove(`type=panel&id=${id}`);
    });

    it.each([
        ['no name', { name: '', testIds: [1] }],
        ['no tests', { name: 'x', testIds: [] }],
        ['a test that does not exist', { name: 'x', testIds: [1, 999999] }],
        ['a name that is too long', { name: 'x'.repeat(101), testIds: [1] }],
    ])('rejects %s', async (_l, body) => {
        expect((await send({ type: 'panel', ...body })).status).toBe(400);
    });

    it('a bad type or missing id on delete is a 400', async () => {
        expect((await remove('type=nonsense&id=1')).status).toBe(400);
        expect((await remove('type=panel')).status).toBe(400);
        expect((await remove('type=favourite&medicineId=abc')).status).toBe(400);
    });
});

describe('recent medicines and access', () => {
    it('lists what this doctor prescribed lately, most used first, with the latest line', async () => {
        const a = await addMedicine(`RecentA-${Date.now()}`, [{ qty: 50, expiryDays: 100, sell: 2 }]);
        const b = await addMedicine(`RecentB-${Date.now()}`, [{ qty: 50, expiryDays: 100, sell: 2 }]);
        for (const patient of [ALICE, BOB]) {
            await consult(await makeAppointment(patient), { status: 'ONGOING', prescription: [line(a, { duration: '7 days' })] });
        }
        await consult(await makeAppointment(ALICE), { status: 'ONGOING', prescription: [line(b)] });
        const recent = (await (await presets()).json()).recent;
        const ids = recent.map((r: any) => r.medicineId);
        expect(ids.indexOf(a)).toBeLessThan(ids.indexOf(b));
        expect(recent.find((r: any) => r.medicineId === a)).toMatchObject({ duration: '7 days' });
        expect(recent.length).toBeLessThanOrEqual(8);
    });

    it('is for doctors only', async () => {
        const { GET, POST, DELETE } = await import('@/app/api/doctor/presets/route');
        for (const role of ['PATIENT', 'PHARMACIST', 'RECEPTIONIST'] as const) {
            await as(role, role === 'PATIENT' ? ALICE : role === 'PHARMACIST' ? 6 : 8);
            expect((await GET()).status, role).toBe(403);
            expect((await POST(post('/x', { type: 'panel', name: 'x', testIds: [1] }))).status, role).toBe(403);
            expect((await DELETE(new Request('http://x?type=panel&id=1', { method: 'DELETE' }))).status, role).toBe(403);
        }
    });
});
