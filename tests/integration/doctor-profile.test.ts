import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { pool, query } from '@/lib/db';
import { as, post, rows, one } from './helpers';

// The doctor edits their own details and fee. Working hours and time off belong to the administrator
// (see admin-doctor-schedule.test.ts). Uses Dr. Doe (user 3).
const DR = 3;

afterAll(async () => { await pool.end(); });

const valid = (over: Record<string, unknown> = {}) => ({
    name: 'Dr. Jane Doe', phone: '0777654321', consultation_fee: 2000, license_number: 'SLMC-1002',
    specialization: 'Paediatrician', ...over,
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

beforeAll(async () => { await saveProfile(valid()); });

describe('profile', () => {
    it('saves personal details, fee, licence and specialization', async () => {
        const res = await saveProfile(valid({ name: 'Dr. Jane Q. Doe', consultation_fee: 2250.5, specialization: 'Cardiologist' }));
        expect(res.status).toBe(200);
        const body = await (await getProfile()).json();
        expect(body.user.name).toBe('Dr. Jane Q. Doe');
        expect(Number(body.doctor.consultation_fee)).toBe(2250.5);
        expect(body.doctor).toMatchObject({ specialization: 'Cardiologist', license_number: 'SLMC-1002' });
        await saveProfile(valid());   // restore
    });

    it('the session reports the new name straight away', async () => {
        await saveProfile(valid({ name: 'Dr. Renamed Doe' }));
        await as('DOCTOR', DR);
        const { GET } = await import('@/app/api/auth/session/route');
        expect((await (await GET()).json()).user.name).toBe('Dr. Renamed Doe');
        await saveProfile(valid());
    });

    it.each([
        ['empty name', { name: '' }],
        ['negative fee', { consultation_fee: -5 }],
        ['non-numeric fee', { consultation_fee: 'free' }],
        ['missing licence', { license_number: '' }],
    ])('rejects %s', async (_l, over) => {
        expect((await saveProfile(valid(over))).status).toBe(400);
    });

    it('a bad save rolls everything back, including the name', async () => {
        const before = (await one(`SELECT name FROM users WHERE id = ?`, [DR])).name;
        await saveProfile(valid({ name: 'Should Not Stick', consultation_fee: -1 }));
        expect((await one(`SELECT name FROM users WHERE id = ?`, [DR])).name).toBe(before);
    });

    it('a doctor can no longer change their own hours, slot length or time off', async () => {
        const hours = await rows(`SELECT day, start_time, end_time FROM doctor_schedules WHERE doctor_id = ? ORDER BY day, start_time`, [DR]);
        const slot = (await one(`SELECT slot_duration FROM doctors WHERE user_id = ?`, [DR])).slot_duration;
        expect((await saveProfile(valid({ slot_duration: 60, schedules: [{ days: ['Sunday'], start_time: '01:00', end_time: '02:00' }] }))).status).toBe(200);
        expect(await rows(`SELECT day, start_time, end_time FROM doctor_schedules WHERE doctor_id = ? ORDER BY day, start_time`, [DR])).toEqual(hours);
        expect((await one(`SELECT slot_duration FROM doctors WHERE user_id = ?`, [DR])).slot_duration).toBe(slot);
        expect((await import('node:fs')).existsSync('src/app/api/doctor/profile/leaves/route.ts')).toBe(false);
    });

    it('still shows the doctor their hours and upcoming time off', async () => {
        const body = await (await getProfile()).json();
        expect(Array.isArray(body.schedules)).toBe(true);
        expect(Array.isArray(body.leaves)).toBe(true);
    });

    it('a doctor without a profile row gets a clear 404, not a crash', async () => {
        const u: any = await query(`INSERT INTO users (email, password_hash, name, role, is_verified) VALUES (?, ?, 'Ghost Doc', 'DOCTOR', TRUE)`, [`ghostdoc.${Date.now()}@dp-test.local`, 'x']);
        await as('DOCTOR', u.insertId);
        const { GET, POST } = await import('@/app/api/doctor/profile/route');
        expect((await GET()).status).toBe(404);
        expect((await POST(post('/x', valid()))).status).toBe(404);
    });
});
