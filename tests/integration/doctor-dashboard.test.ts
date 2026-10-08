import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { pool, query } from '@/lib/db';
import { ALICE, BOB, as, isoDate } from './helpers';

// The doctor dashboard cards say "Total Revenue - from paid bills" and "patients seen". These tests pin the numbers
// to those labels, using a brand-new doctor so every count is exact.

let DR = 0;
const FEE = 1500;
afterAll(async () => { await pool.end(); });

async function appointment(patient: number, daysFromToday: number, status: string, slot: string) {
    const r: any = await query(
        `INSERT INTO appointments (patient_id, doctor_id, date, time_slot, queue_number, status) VALUES (?, ?, ?, ?, 1, ?)`,
        [patient, DR, isoDate(daysFromToday), slot, status]);
    return r.insertId as number;
}
async function bill(appointmentId: number, status: 'PAID' | 'PENDING', fee = FEE) {
    await query(
        `INSERT INTO bills (appointment_id, doctor_fee, service_charge, pharmacy_total, lab_total, total_amount, status, paid_at)
         VALUES (?, ?, 500, 0, 0, ?, ?, ${status === 'PAID' ? 'NOW()' : 'NULL'})`, [appointmentId, fee, fee + 500, status]);
}

beforeAll(async () => {
    const u: any = await query(
        `INSERT INTO users (email, password_hash, name, role, is_verified) VALUES (?, 'x', 'Dr. Dash Board', 'DOCTOR', TRUE)`,
        [`dash.${Date.now()}@dd-test.local`]);
    DR = u.insertId;
    await query(`INSERT INTO doctors (user_id, specialization, license_number, consultation_fee) VALUES (?, 'GP', ?, ?)`, [DR, `LIC-${DR}`, FEE]);

    await appointment(ALICE, 0, 'PENDING', '09:00');                  // today, counts
    await appointment(BOB, 0, 'CANCELLED', '09:15');                  // today, cancelled: does not count
    await appointment(ALICE, 1, 'PENDING', '09:00');                  // upcoming
    await appointment(BOB, 2, 'CANCELLED', '09:00');                  // upcoming but cancelled
    await bill(await appointment(ALICE, -2, 'COMPLETED', '09:00'), 'PAID');      // paid
    await bill(await appointment(ALICE, -3, 'COMPLETED', '09:00'), 'PAID');      // paid, same patient again
    await bill(await appointment(BOB, -1, 'COMPLETED', '09:00'), 'PENDING');     // completed but not yet paid
    await appointment(BOB, -4, 'PENDING', '09:00');                              // never attended / still pending
});

const stats = async () => {
    await as('DOCTOR', DR);
    const { GET } = await import('@/app/api/doctor/stats/route');
    return (await GET()).json();
};
const chart = async () => {
    await as('DOCTOR', DR);
    const { GET } = await import('@/app/api/doctor/chart-data/route');
    return GET();
};

describe('doctor stats', () => {
    it('counts today and upcoming appointments, ignoring cancelled ones', async () => {
        const s = await stats();
        expect(s.todayAppointments).toBe(1);
        expect(s.upcomingAppointments).toBe(1);
    });

    it('counts a patient as "seen" only after a completed visit (once, however many visits)', async () => {
        // ALICE has two completed visits; BOB's visit is completed but unpaid -> still seen; the pending one does not count
        expect((await stats()).totalPatients).toBe(2);
    });

    it('revenue is the doctor fee on PAID bills of completed visits, not a projection', async () => {
        expect((await stats()).revenue).toBe(2 * FEE);       // the two paid bills; not the unpaid one, not 8 appointments x fee
    });

    it('everything is numeric', async () => {
        const s = await stats();
        for (const key of ['todayAppointments', 'upcomingAppointments', 'totalPatients', 'revenue']) expect(typeof s[key], key).toBe('number');
    });

    it('a doctor with no activity gets zeros, not an error', async () => {
        const u: any = await query(`INSERT INTO users (email, password_hash, name, role, is_verified) VALUES (?, 'x', 'Dr. Empty', 'DOCTOR', TRUE)`, [`empty.${Date.now()}@dd-test.local`]);
        await query(`INSERT INTO doctors (user_id, specialization, license_number, consultation_fee) VALUES (?, 'GP', ?, 100)`, [u.insertId, `LIC-${u.insertId}`]);
        await as('DOCTOR', u.insertId);
        const { GET } = await import('@/app/api/doctor/stats/route');
        expect(await (await GET()).json()).toEqual({ todayAppointments: 0, upcomingAppointments: 0, totalPatients: 0, revenue: 0 });
    });

    it('only ever reports the signed-in doctor\'s own data', async () => {
        await as('DOCTOR', 2);                     // Dr. Smith, who has hundreds of appointments from other suites
        const { GET } = await import('@/app/api/doctor/stats/route');
        const other = await (await GET()).json();
        expect(other.revenue).not.toBe(2 * FEE);
    });
});

describe('doctor weekly chart', () => {
    it('returns the last 7 days, oldest first, ending today', async () => {
        const res = await chart();
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toHaveLength(7);
        const expectedDays = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (6 - i));
            return d.toLocaleDateString('en-US', { weekday: 'short' });
        });
        expect(data.map((d: any) => d.day)).toEqual(expectedDays);
    });

    it('shows appointments per day (cancelled excluded) and revenue only from paid, completed visits', async () => {
        const data = await (await chart()).json();
        // index 6 = today, 5 = yesterday, 4 = 2 days ago, 3 = 3 days ago, 2 = 4 days ago
        expect(data[6]).toMatchObject({ appointments: 1, revenue: 0 });          // today: one live booking, nothing paid yet
        expect(data[5]).toMatchObject({ appointments: 1, revenue: 0 });          // yesterday: completed but the bill is unpaid
        expect(data[4]).toMatchObject({ appointments: 1, revenue: FEE });
        expect(data[3]).toMatchObject({ appointments: 1, revenue: FEE });
        expect(data[2]).toMatchObject({ appointments: 1, revenue: 0 });          // 4 days ago: still pending
        expect(data[1]).toMatchObject({ appointments: 0, revenue: 0 });
        expect(data[0]).toMatchObject({ appointments: 0, revenue: 0 });
    });

    it('weekly revenue adds up to the dashboard total for the same period', async () => {
        const data = await (await chart()).json();
        const weekly = data.reduce((s: number, d: any) => s + d.revenue, 0);
        expect(weekly).toBe((await stats()).revenue);       // all paid visits here fall inside the week
    });

    it('requires the doctor role', async () => {
        await as('PATIENT', ALICE);
        const { GET } = await import('@/app/api/doctor/chart-data/route');
        expect((await GET()).status).toBe(403);
    });
});
