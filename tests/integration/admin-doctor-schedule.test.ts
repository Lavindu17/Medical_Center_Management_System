import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { pool, query } from '@/lib/db';
import { as, post, ctx, rows, one, isoDate, ALICE, PHARMACIST, RECEPTIONIST } from './helpers';
import { addDays, weekday } from '@/lib/hr-time';

// The administrator picks a doctor and sets their weekly hours, slot length and time off.
// Uses its own doctor so the shared test doctors keep their all-day schedules.
const ADMIN = 1;
let doc = 0;
let hr = 0;

afterAll(async () => { await pool.end(); });

const sessions = (...s: [string, string, string][]) => s.map(([day, start, end]) => ({ day, start, end }));
const put = async (body: unknown, id: number | string = doc) => {
    await as('ADMIN', ADMIN);
    return (await import('@/app/api/admin/doctors/[id]/schedule/route')).PUT(post('/x', body, 'PUT'), ctx(id));
};
const get = async (id: number | string = doc) => {
    await as('ADMIN', ADMIN);
    return (await import('@/app/api/admin/doctors/[id]/schedule/route')).GET(new Request('http://x'), ctx(id));
};
const off = async (body: unknown, id: number | string = doc) => {
    await as('ADMIN', ADMIN);
    return (await import('@/app/api/admin/doctors/[id]/leaves/route')).POST(post('/x', body), ctx(id));
};
const unoff = async (leaveId: unknown, id: number | string = doc) => {
    await as('ADMIN', ADMIN);
    return (await import('@/app/api/admin/doctors/[id]/leaves/route')).DELETE(new Request(`http://x?id=${leaveId}`, { method: 'DELETE' }), ctx(id));
};
const stored = () => rows(`SELECT day, TIME_FORMAT(start_time, '%H:%i') s, TIME_FORMAT(end_time, '%H:%i') e FROM doctor_schedules WHERE doctor_id = ? ORDER BY day, start_time`, [doc]);
const book = async (date: string, timeSlot: string) => {
    await as('PATIENT', ALICE);
    return (await import('@/app/api/appointments/route')).POST(post('/x', { patientId: ALICE, doctorId: doc, date, timeSlot, reason: 'x' }));
};
const addBooking = async (date: string, time = '10:00', status = 'PENDING') =>
    (await query<any>(`INSERT INTO appointments (patient_id, doctor_id, date, time_slot, queue_number, status) VALUES (?, ?, ?, ?, 1, ?)`, [ALICE, doc, date, time, status])).insertId as number;
const notifications = (user: number, type: string) => rows(`SELECT id FROM notifications WHERE user_id = ? AND type = ?`, [user, type]);

beforeAll(async () => {
    const u: any = await query(`INSERT INTO users (email, password_hash, name, role, is_verified) VALUES (?, 'x', 'Dr. Admin Sched', 'DOCTOR', 1)`, [`adm.sched.${Date.now()}@test.local`]);
    doc = u.insertId;
    hr = ((await query(`INSERT INTO users (email, password_hash, name, role, is_verified) VALUES (?, 'x', 'HR Admin Sched', 'HR_MANAGER', 1)`, [`adm.hr.${Date.now()}@test.local`])) as any).insertId;
    await query(`INSERT INTO doctors (user_id, specialization, license_number, consultation_fee, slot_duration) VALUES (?, 'GP', ?, 1000, 15)`, [doc, `ADM-${doc}`]);
});

describe('weekly hours', () => {
    it('reads back what was saved: sessions, slot length, one row per session', async () => {
        const body = { slotDuration: 20, sessions: sessions(['Monday', '09:00', '12:00'], ['Monday', '14:00', '17:30'], ['Wednesday', '09:00', '12:00']) };
        expect((await put(body)).status).toBe(200);
        expect(await stored()).toEqual([
            { day: 'Monday', s: '09:00', e: '12:00' }, { day: 'Monday', s: '14:00', e: '17:30' }, { day: 'Wednesday', s: '09:00', e: '12:00' }]);
        const got = await (await get()).json();
        expect(got.slotDuration).toBe(20);
        expect(got.sessions).toHaveLength(3);
        expect(got.doctor.name).toBe('Dr. Admin Sched');
    });

    it('replaces the old hours on every save, and an empty list means no working days', async () => {
        await put({ slotDuration: 15, sessions: sessions(['Friday', '08:00', '10:00']) });
        expect(await stored()).toEqual([{ day: 'Friday', s: '08:00', e: '10:00' }]);
        expect((await put({ slotDuration: 15, sessions: [] })).status).toBe(200);
        expect(await stored()).toEqual([]);
    });

    it('patients are offered exactly the new hours', async () => {
        await put({ slotDuration: 30, sessions: sessions(['Monday', '09:00', '11:00']) });
        let monday = addDays(isoDate(14), 0);
        while (weekday(monday) !== 1) monday = addDays(monday, 1);
        const { GET } = await import('@/app/api/doctors/availability/route');
        const offered = (await (await GET(new Request(`http://x?doctorId=${doc}&date=${monday}`))).json()).slots.map((s: any) => s.time);
        expect(offered).toEqual(['09:00', '09:30', '10:00', '10:30']);
        expect((await book(monday, '10:30')).status).toBe(201);
        expect((await book(monday, '11:00')).status).toBe(400);
    });

    it.each([
        ['7-minute slots', { slotDuration: 7, sessions: [] }],
        ['session that ends before it starts', { slotDuration: 15, sessions: sessions(['Monday', '17:00', '09:00']) }],
        ['zero-length session', { slotDuration: 15, sessions: sessions(['Monday', '09:00', '09:00']) }],
        ['invented day', { slotDuration: 15, sessions: sessions(['Funday', '09:00', '10:00']) }],
        ['bad time', { slotDuration: 15, sessions: sessions(['Monday', '9am', '10:00']) }],
        ['overlapping sessions', { slotDuration: 15, sessions: sessions(['Monday', '09:00', '12:00'], ['Monday', '11:00', '14:00']) }],
        ['no body fields', {}],
    ])('rejects %s and keeps the saved hours', async (_l, body) => {
        await put({ slotDuration: 15, sessions: sessions(['Tuesday', '09:00', '10:00']) });
        const before = await stored();
        expect((await put(body)).status).toBe(400);
        expect(await stored()).toEqual(before);
    });

    it('sessions that touch (one ends when the next starts) are allowed', async () => {
        expect((await put({ slotDuration: 15, sessions: sessions(['Friday', '09:00', '12:00'], ['Friday', '12:00', '15:00']) })).status).toBe(200);
    });

    it('reports (but does not cancel) upcoming bookings that no longer fit', async () => {
        const monday = (end: string) => ({ slotDuration: 15, sessions: sessions(['Monday', '09:00', end]) });
        const outside = async (end: string) => (await (await put(monday(end))).json()).outsideSchedule as number;
        let date = addDays(isoDate(30), 0);
        while (weekday(date) !== 1) date = addDays(date, 1);
        const base = await outside('12:00');
        const a = await addBooking(date, '10:00');
        const b = await addBooking(date, '11:30');
        expect(await outside('11:00')).toBe(base + 1);
        expect((await one(`SELECT status FROM appointments WHERE id = ?`, [b])).status).toBe('PENDING');
        expect(await outside('12:00')).toBe(base);
        await query(`DELETE FROM appointments WHERE id IN (?, ?)`, [a, b]);
    });

    it('tells the doctor in-app, and leaves an audit entry', async () => {
        const before = (await notifications(doc, 'SCHEDULE_CHANGED')).length;
        await put({ slotDuration: 15, sessions: sessions(['Thursday', '09:00', '10:00']) });
        expect((await notifications(doc, 'SCHEDULE_CHANGED')).length).toBe(before + 1);
        expect(await one(`SELECT id FROM audit_log WHERE entity_type = 'DOCTOR_PROFILE' AND entity_id = ? AND actor_id = ? ORDER BY id DESC LIMIT 1`, [String(doc), ADMIN])).toBeTruthy();
    });

    it('unknown doctor is 404, bad id is 400, a non-doctor user is 404', async () => {
        expect((await put({ slotDuration: 15, sessions: [] }, 999999)).status).toBe(404);
        expect((await put({ slotDuration: 15, sessions: [] }, 'abc')).status).toBe(400);
        expect((await get(ALICE)).status).toBe(404);
        expect((await get(999999)).status).toBe(404);
    });
});

describe('who may change it', () => {
    it.each(['DOCTOR', 'PATIENT', 'RECEPTIONIST', 'PHARMACIST', 'HR_MANAGER'] as const)('%s is refused', async (role) => {
        const id = { DOCTOR: doc, RECEPTIONIST, PHARMACIST, HR_MANAGER: hr, PATIENT: ALICE }[role];
        await as(role, id);
        const sched = await import('@/app/api/admin/doctors/[id]/schedule/route');
        const leaves = await import('@/app/api/admin/doctors/[id]/leaves/route');
        expect((await sched.GET(new Request('http://x'), ctx(doc))).status).toBe(403);
        expect((await sched.PUT(post('/x', { slotDuration: 15, sessions: [] }, 'PUT'), ctx(doc))).status).toBe(403);
        expect((await leaves.POST(post('/x', { from: isoDate(5) }), ctx(doc))).status).toBe(403);
        expect((await leaves.DELETE(new Request('http://x?id=1', { method: 'DELETE' }), ctx(doc))).status).toBe(403);
    });
});

describe('time off', () => {
    it('blocks a range of days, skips days already blocked, and patients cannot book them', async () => {
        const from = isoDate(60), to = isoDate(63);
        await off({ from: isoDate(61) });                                     // one day already blocked
        const res = await off({ from, to, reason: 'Conference' });
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body).toMatchObject({ days: 3, alreadyBlocked: 1 });
        expect(await rows(`SELECT id FROM doctor_leaves WHERE doctor_id = ? AND date BETWEEN ? AND ?`, [doc, from, to])).toHaveLength(4);
        expect((await book(from, '10:00')).status).toBe(409);
        const listed = (await (await get()).json()).leaves.map((l: any) => l.date);
        expect(listed).toEqual(expect.arrayContaining([from, isoDate(62), to]));
    });

    it('a dry run reports the impact and changes nothing', async () => {
        const date = isoDate(70);
        const a = await addBooking(date);
        await addBooking(date, '10:15', 'CANCELLED');
        const before = (await rows(`SELECT id FROM doctor_leaves WHERE doctor_id = ?`, [doc])).length;
        const res = await off({ from: date, to: addDays(date, 2), dryRun: true });
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ days: 3, alreadyBlocked: 0, affectedAppointments: 1 });
        expect((await rows(`SELECT id FROM doctor_leaves WHERE doctor_id = ?`, [doc])).length).toBe(before);
        expect((await one(`SELECT status FROM appointments WHERE id = ?`, [a])).status).toBe('PENDING');
    });

    it('keeps booked appointments, and tells the patient, the front desk and the doctor', async () => {
        const date = isoDate(75);
        const a = await addBooking(date);
        const patient = (await notifications(ALICE, 'DOCTOR_LEAVE')).length;
        const desk = (await notifications(RECEPTIONIST, 'DOCTOR_LEAVE')).length;
        const doctor = (await notifications(doc, 'SCHEDULE_CHANGED')).length;
        const res = await off({ from: date });
        expect((await res.json()).affectedAppointments).toBe(1);
        expect((await one(`SELECT status FROM appointments WHERE id = ?`, [a])).status).toBe('PENDING');
        expect((await notifications(ALICE, 'DOCTOR_LEAVE')).length).toBe(patient + 1);
        expect((await notifications(RECEPTIONIST, 'DOCTOR_LEAVE')).length).toBe(desk + 1);
        expect((await notifications(doc, 'SCHEDULE_CHANGED')).length).toBe(doctor + 1);
    });

    it('all days already blocked is a 409', async () => {
        const date = isoDate(80);
        await off({ from: date });
        const again = await off({ from: date });
        expect(again.status).toBe(409);
    });

    it('today is allowed; the past is not', async () => {
        expect((await off({ from: isoDate(-1) })).status).toBe(400);
        expect((await off({ from: isoDate(0) })).status).toBe(201);
    });

    it.each([
        [{}], [{ from: 'abc' }], [{ from: '2030-02-30' }], [{ from: null }],
        [{ from: isoDate(90), to: isoDate(89) }],
        [{ from: isoDate(90), to: addDays(isoDate(90), 400) }],
        [{ from: isoDate(90), reason: 'x'.repeat(300) }],
    ])('rejects invalid input %j', async (body) => {
        expect((await off(body)).status).toBe(400);
    });

    it('unknown doctor is 404', async () => {
        expect((await off({ from: isoDate(90) }, 999999)).status).toBe(404);
    });

    it('removes a blocked day so the doctor can be booked again', async () => {
        const date = isoDate(95);
        await put({ slotDuration: 15, sessions: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => ({ day: d, start: '08:00', end: '18:00' })) });
        await off({ from: date });
        const leaf = await one(`SELECT id FROM doctor_leaves WHERE doctor_id = ? AND date = ?`, [doc, date]);
        expect((await book(date, '10:00')).status).toBe(409);
        expect((await unoff(leaf.id)).status).toBe(200);
        expect((await book(date, '10:00')).status).toBe(201);
    });

    it('leave removal: bad id, unknown id, another doctor\'s leave', async () => {
        expect((await unoff('abc')).status).toBe(400);
        expect((await unoff(0)).status).toBe(400);
        expect((await unoff(999999)).status).toBe(404);
        const other: any = await query(`INSERT INTO doctor_leaves (doctor_id, date) VALUES (2, ?)`, [isoDate(96)]);
        expect((await unoff(other.insertId)).status).toBe(404);
        expect(await one(`SELECT id FROM doctor_leaves WHERE id = ?`, [other.insertId])).toBeTruthy();
    });

    it('a day that comes from approved HR leave cannot be removed here', async () => {
        const date = isoDate(97);
        const lr: any = await query(`INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, days, status) VALUES (?, 1, ?, ?, 1, 'APPROVED')`, [doc, date, date]);
        const row: any = await query(`INSERT INTO doctor_leaves (doctor_id, date, reason, leave_request_id) VALUES (?, ?, 'HR leave', ?)`, [doc, date, lr.insertId]);
        const res = await unoff(row.insertId);
        expect(res.status).toBe(409);
        expect(await one(`SELECT id FROM doctor_leaves WHERE id = ?`, [row.insertId])).toBeTruthy();
        const listed = (await (await get()).json()).leaves.find((l: any) => l.date === date);
        expect(listed.fromHr).toBe(true);
    });
});
