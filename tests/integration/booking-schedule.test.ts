import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { pool, query } from '@/lib/db';
import { as, post, ALICE } from './helpers';
import { addDays, weekday } from '@/lib/hr-time';

// Booking only accepts times the doctor actually offers: a working day, inside a session, on the slot grid.
// (Before this, a hand-written request could book 03:07 on a Sunday with a doctor who does not work then.)

afterAll(async () => { await pool.end(); });

let doctor = 0;
let monday = '';

const book = async (date: string, timeSlot: string) =>
    (await import('@/app/api/appointments/route')).POST(post('/x', { patientId: ALICE, doctorId: doctor, date, timeSlot, reason: 'x' }));

beforeAll(async () => {
    const u: any = await query(`INSERT INTO users (email, password_hash, name, role, is_verified) VALUES (?, 'x', 'Dr. Sched Test', 'DOCTOR', 1)`, [`sched.${Date.now()}@test.local`]);
    doctor = u.insertId;
    await query(`INSERT INTO doctors (user_id, specialization, license_number, consultation_fee, slot_duration) VALUES (?, 'GP', ?, 1000, 15)`, [doctor, `SCHED-${doctor}`]);
    await query(`INSERT INTO doctor_schedules (doctor_id, day, start_time, end_time) VALUES (?, 'Monday', '09:00:00', '12:00:00'), (?, 'Monday', '14:00:00', '16:00:00')`, [doctor, doctor]);
    // The first Monday at least two weeks away
    let d = addDays(new Date().toISOString().slice(0, 10), 14);
    while (weekday(d) !== 1) d = addDays(d, 1);
    monday = d;
});

describe('booking respects the doctor schedule', () => {
    it('accepts a slot inside a session and on the grid, in either session', async () => {
        await as('PATIENT', ALICE);
        expect((await book(monday, '09:15')).status).toBe(201);
        expect((await book(monday, '15:45')).status).toBe(201);
    });

    it.each([
        ['off the slot grid', '09:07'],
        ['before the session starts', '08:45'],
        ['at the moment the session ends', '12:00'],
        ['in the gap between sessions', '13:00'],
        ['after the last session', '17:00'],
        ['in the middle of the night', '03:00'],
    ])('refuses a time %s', async (_label, time) => {
        await as('PATIENT', ALICE);
        const res = await book(monday, time);
        expect(res.status).toBe(400);
        expect((await res.json()).message).toMatch(/available slots/i);
    });

    it('refuses a day the doctor does not work, whatever the time', async () => {
        await as('PATIENT', ALICE);
        const tuesday = addDays(monday, 1);
        expect((await book(tuesday, '09:15')).status).toBe(400);
        const sunday = addDays(monday, 6);
        expect((await book(sunday, '10:00')).status).toBe(400);
    });

    it('does not offer, or accept, a slot from a schedule block that has been switched off', async () => {
        await query(`UPDATE doctor_schedules SET is_active = 0 WHERE doctor_id = ? AND start_time = '14:00:00'`, [doctor]);
        await as('PATIENT', ALICE);
        expect((await book(monday, '14:15')).status).toBe(400);
        const { GET } = await import('@/app/api/doctors/availability/route');
        const offered = (await (await GET(new Request(`http://x?doctorId=${doctor}&date=${monday}`))).json()).slots.map((s: any) => s.time);
        expect(offered).not.toContain('14:15');
        expect(offered).toContain('10:00');
    });

    it('a doctor on leave has no slots and cannot be booked', async () => {
        await query('INSERT INTO doctor_leaves (doctor_id, date, reason) VALUES (?, ?, ?)', [doctor, addDays(monday, 7), 'away']);
        await as('PATIENT', ALICE);
        expect((await book(addDays(monday, 7), '10:00')).status).toBe(409);
        const { GET } = await import('@/app/api/doctors/availability/route');
        expect((await (await GET(new Request(`http://x?doctorId=${doctor}&date=${addDays(monday, 7)}`))).json()).slots).toEqual([]);
    });
});
