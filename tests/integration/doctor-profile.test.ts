import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { pool, query } from '@/lib/db';
import { ALICE, as, post, isoDate, one, rows } from './helpers';

// Plan section 5: doctor profile, weekly schedule and leave days. Uses Dr. Doe (user 3) so the other
// suites' use of Dr. Smith is untouched.
const DR = 3;

afterAll(async () => { await pool.end(); });

const valid = (over: Record<string, unknown> = {}) => ({
    name: 'Dr. Jane Doe', phone: '0777654321', consultation_fee: 2000, license_number: 'SLMC-1002',
    specialization: 'Paediatrician', slot_duration: 15,
    schedules: [{ days: ['Monday', 'Tuesday'], start_time: '09:00', end_time: '12:00' }],
    ...over,
});

async function saveProfile(body: unknown) {
    await as('DOCTOR', DR);
    const { POST } = await import('@/app/api/doctor/profile/route');
    return POST(post('/x', body));
}
async function getProfile() {
    await as('DOCTOR', DR);
    const { GET } = await import('@/app/api/doctor/profile/route');
    return GET();
}
async function addLeave(body: unknown) {
    await as('DOCTOR', DR);
    const { POST } = await import('@/app/api/doctor/profile/leaves/route');
    return POST(post('/x', body));
}
async function removeLeave(id: unknown) {
    await as('DOCTOR', DR);
    const { DELETE } = await import('@/app/api/doctor/profile/leaves/route');
    return DELETE(new Request(`http://x/api/doctor/profile/leaves?id=${id}`, { method: 'DELETE' }));
}

beforeAll(async () => { await saveProfile(valid()); });

describe('profile', () => {
    it('saves personal details, fee, licence, specialization and slot length', async () => {
        const res = await saveProfile(valid({ name: 'Dr. Jane Q. Doe', consultation_fee: 2250.5, specialization: 'Cardiologist', slot_duration: 20 }));
        expect(res.status).toBe(200);
        const body = await (await getProfile()).json();
        expect(body.user.name).toBe('Dr. Jane Q. Doe');
        expect(Number(body.doctor.consultation_fee)).toBe(2250.5);
        expect(body.doctor).toMatchObject({ specialization: 'Cardiologist', slot_duration: 20, license_number: 'SLMC-1002' });
        await saveProfile(valid());   // restore
    });

    it('the session reports the new name straight away', async () => {
        await saveProfile(valid({ name: 'Dr. Renamed Doe' }));
        await as('DOCTOR', DR);
        const { GET } = await import('@/app/api/auth/session/route');
        expect((await (await GET()).json()).user.name).toBe('Dr. Renamed Doe');
        await saveProfile(valid());
    });

    it('stores the weekly schedule as one row per day, and replaces it on every save', async () => {
        await saveProfile(valid({ schedules: [
            { days: ['Monday', 'Wednesday'], start_time: '09:00', end_time: '12:00' },
            { days: ['Monday'], start_time: '14:00', end_time: '17:30' },
        ] }));
        const got = await rows(`SELECT day, TIME_FORMAT(start_time, '%H:%i') s, TIME_FORMAT(end_time, '%H:%i') e FROM doctor_schedules WHERE doctor_id = ? ORDER BY day, start_time`, [DR]);
        expect(got).toEqual([
            { day: 'Monday', s: '09:00', e: '12:00' },
            { day: 'Monday', s: '14:00', e: '17:30' },
            { day: 'Wednesday', s: '09:00', e: '12:00' },
        ]);
        await saveProfile(valid({ schedules: [] }));
        expect(await rows(`SELECT id FROM doctor_schedules WHERE doctor_id = ?`, [DR])).toHaveLength(0);
        await saveProfile(valid());
    });

    it.each([
        ['empty name', { name: '' }],
        ['negative fee', { consultation_fee: -5 }],
        ['non-numeric fee', { consultation_fee: 'free' }],
        ['missing licence', { license_number: '' }],
        ['7-minute slots', { slot_duration: 7 }],
        ['zero-minute slots', { slot_duration: 0 }],
        ['negative slots', { slot_duration: -15 }],
        ['block that ends before it starts', { schedules: [{ days: ['Monday'], start_time: '17:00', end_time: '09:00' }] }],
        ['zero-length block', { schedules: [{ days: ['Monday'], start_time: '09:00', end_time: '09:00' }] }],
        ['block with no days', { schedules: [{ days: [], start_time: '09:00', end_time: '12:00' }] }],
        ['invented day', { schedules: [{ days: ['Funday'], start_time: '09:00', end_time: '12:00' }] }],
        ['bad time', { schedules: [{ days: ['Monday'], start_time: '9am', end_time: '12:00' }] }],
        ['overlapping blocks', { schedules: [
            { days: ['Monday'], start_time: '09:00', end_time: '12:00' },
            { days: ['Monday', 'Tuesday'], start_time: '11:00', end_time: '14:00' }] }],
    ])('rejects %s and leaves the saved schedule untouched', async (_l, over) => {
        const before = await rows(`SELECT day FROM doctor_schedules WHERE doctor_id = ? ORDER BY day`, [DR]);
        expect((await saveProfile(valid(over))).status).toBe(400);
        expect(await rows(`SELECT day FROM doctor_schedules WHERE doctor_id = ? ORDER BY day`, [DR])).toEqual(before);
    });

    it('adjacent blocks (one ends when the next starts) are allowed', async () => {
        expect((await saveProfile(valid({ schedules: [
            { days: ['Friday'], start_time: '09:00', end_time: '12:00' },
            { days: ['Friday'], start_time: '12:00', end_time: '15:00' }] }))).status).toBe(200);
        await saveProfile(valid());
    });

    it('a bad save rolls everything back, including the name', async () => {
        const before = (await one(`SELECT name FROM users WHERE id = ?`, [DR])).name;
        await saveProfile(valid({ name: 'Should Not Stick', slot_duration: 7 }));
        expect((await one(`SELECT name FROM users WHERE id = ?`, [DR])).name).toBe(before);
    });

    it('reports (but does not cancel) upcoming bookings that no longer fit the new hours', async () => {
        // 2030-01-07 is a Monday. Other suites may have bookings for this doctor, so compare against a baseline.
        const monday = (end: string) => valid({ schedules: [{ days: ['Monday'], start_time: '09:00', end_time: end }] });
        const outside = async (end: string) => (await (await saveProfile(monday(end))).json()).outsideSchedule as number;
        const base11 = await outside('11:00');
        const base12 = await outside('12:00');
        const a: any = await query(`INSERT INTO appointments (patient_id, doctor_id, date, time_slot, queue_number, status) VALUES (?, ?, '2030-01-07', '10:00', 1, 'PENDING')`, [ALICE, DR]);
        const b: any = await query(`INSERT INTO appointments (patient_id, doctor_id, date, time_slot, queue_number, status) VALUES (?, ?, '2030-01-07', '11:30', 2, 'PENDING')`, [ALICE, DR]);
        expect(await outside('11:00')).toBe(base11 + 1);                           // 11:30 no longer fits, 10:00 still does
        expect((await one(`SELECT status FROM appointments WHERE id = ?`, [b.insertId])).status).toBe('PENDING');
        expect(await outside('12:00')).toBe(base12);                               // both fit again
        await query(`DELETE FROM appointments WHERE id IN (?, ?)`, [a.insertId, b.insertId]);
        await saveProfile(valid());
    });

    it('a schedule change and a booking never interleave (both take the doctor lock)', async () => {
        const date = isoDate(80);
        const { identity } = await import('../helpers/state');
        const { tokenFor } = await import('../helpers/auth');
        const { POST: book } = await import('@/app/api/appointments/route');
        const doctorToken = await tokenFor('DOCTOR', DR);
        const patientToken = await tokenFor('PATIENT', ALICE);
        const results = await Promise.all([
            identity.run(doctorToken, () => saveProfile(valid({ slot_duration: 30 }))),
            identity.run(patientToken, () => book(post('/x', { patientId: ALICE, doctorId: DR, date, timeSlot: '10:00' }))),
            identity.run(doctorToken, () => saveProfile(valid({ slot_duration: 15 }))),
        ]);
        expect(results.every((r) => r.status < 500)).toBe(true);
    });

    it('a doctor without a profile row gets a clear 404, not a crash', async () => {
        const hash = 'x';
        const u: any = await query(`INSERT INTO users (email, password_hash, name, role, is_verified) VALUES (?, ?, 'Ghost Doc', 'DOCTOR', TRUE)`, [`ghostdoc.${Date.now()}@dp-test.local`, hash]);
        await as('DOCTOR', u.insertId);
        const { GET, POST } = await import('@/app/api/doctor/profile/route');
        expect((await GET()).status).toBe(404);
        expect((await POST(post('/x', valid()))).status).toBe(404);
    });
});

describe('leave days', () => {
    it('adds a future leave, lists it, blocks bookings for that day and can be removed', async () => {
        const date = isoDate(90);
        const res = await addLeave({ date, reason: 'Conference' });
        expect(res.status).toBe(201);
        const { id, affectedAppointments } = await res.json();
        expect(affectedAppointments).toBe(0);
        expect((await (await getProfile()).json()).leaves.map((l: any) => l.date)).toContain(date);

        await as('PATIENT', ALICE);
        const { POST: book } = await import('@/app/api/appointments/route');
        expect((await book(post('/x', { patientId: ALICE, doctorId: DR, date, timeSlot: '10:00' }))).status).toBe(409);

        expect((await removeLeave(id)).status).toBe(200);
        await as('PATIENT', ALICE);
        expect((await book(post('/x', { patientId: ALICE, doctorId: DR, date, timeSlot: '10:00' }))).status).toBe(201);
    });

    it('today is allowed; the past is not', async () => {
        expect((await addLeave({ date: isoDate(-1) })).status).toBe(400);
        const today = await addLeave({ date: isoDate(0) });
        expect(today.status).toBe(201);
        await removeLeave((await today.json()).id);
    });

    it('a duplicate day is a 409 with a clear message', async () => {
        const date = isoDate(91);
        const first = await addLeave({ date });
        const dup = await addLeave({ date });
        expect(dup.status).toBe(409);
        expect((await dup.json()).message).toMatch(/already on leave/i);
        await removeLeave((await first.json()).id);
    });

    it.each([[{}], [{ date: 'abc' }], [{ date: '2030-02-30' }], [{ date: null }], [{ date: isoDate(95), reason: 'x'.repeat(300) }]])(
        'rejects invalid input %j', async (body) => {
            expect((await addLeave(body)).status).toBe(400);
        });

    it('tells the doctor how many existing bookings fall on the new leave day, without cancelling them', async () => {
        const date = isoDate(92);
        const a: any = await query(`INSERT INTO appointments (patient_id, doctor_id, date, time_slot, queue_number, status) VALUES (?, ?, ?, '10:00', 1, 'PENDING')`, [ALICE, DR, date]);
        await query(`INSERT INTO appointments (patient_id, doctor_id, date, time_slot, queue_number, status) VALUES (?, ?, ?, '10:15', 2, 'CANCELLED')`, [ALICE, DR, date]);
        const res = await addLeave({ date });
        expect((await res.json()).affectedAppointments).toBe(1);        // the cancelled one does not count
        expect((await one(`SELECT status FROM appointments WHERE id = ?`, [a.insertId])).status).toBe('PENDING');
    });

    it('removing a leave: bad id, unknown id and another doctor\'s leave', async () => {
        expect((await removeLeave('abc')).status).toBe(400);
        expect((await removeLeave(0)).status).toBe(400);
        expect((await removeLeave(999999)).status).toBe(404);
        const other: any = await query(`INSERT INTO doctor_leaves (doctor_id, date) VALUES (2, ?)`, [isoDate(93)]);
        expect((await removeLeave(other.insertId)).status).toBe(404);
        expect(await one(`SELECT id FROM doctor_leaves WHERE id = ?`, [other.insertId])).toBeTruthy();   // still there
    });
});
