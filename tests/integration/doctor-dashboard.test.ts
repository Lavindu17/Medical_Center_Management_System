import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { pool, query } from '@/lib/db';
import { ALICE, BOB, as, isoDate } from './helpers';
import { addDays, localDay } from '@/lib/hr-time';

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
    const { GET } = await import('@/app/api/doctor/overview/route');
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

describe('doctor overview', () => {
    const todayStr = () => localDay(new Date(), 'Asia/Colombo');

    it('returns a week back to a week ahead (15 days), oldest first, with today in the middle and later days flagged upcoming', async () => {
        const res = await chart();
        expect(res.status).toBe(200);
        const { series, today } = await res.json();
        expect(series).toHaveLength(15);
        expect(series[7].day).toBe(today);
        expect(series[0].day).toBe(addDays(today, -7));
        expect(series[14].day).toBe(addDays(today, 7));
        expect(series.map((d: any) => d.upcoming)).toEqual(series.map((_: any, i: number) => i > 7));
    });

    it('shows appointments per day (cancelled excluded) and revenue only from paid, completed visits', async () => {
        const { series } = await (await chart()).json();
        const at = (offset: number) => series[7 + offset];
        expect(at(0)).toMatchObject({ appointments: 1, revenue: 0 });          // today: one live booking, nothing paid yet
        expect(at(-1)).toMatchObject({ appointments: 1, revenue: 0 });         // yesterday: completed but the bill is unpaid
        expect(at(-2)).toMatchObject({ appointments: 1, revenue: FEE });
        expect(at(-3)).toMatchObject({ appointments: 1, revenue: FEE });
        expect(at(-4)).toMatchObject({ appointments: 1, revenue: 0 });         // still pending
        expect(at(-5)).toMatchObject({ appointments: 0, revenue: 0 });
        expect(at(1)).toMatchObject({ appointments: 1, revenue: 0 });          // tomorrow's booking
        expect(at(2)).toMatchObject({ appointments: 0 });                      // the cancelled one is not counted
    });

    it('weekly revenue adds up to the dashboard total for the same period', async () => {
        const { series } = await (await chart()).json();
        const weekly = series.filter((d: any) => !d.upcoming).reduce((s: number, d: any) => s + d.revenue, 0);
        expect(weekly).toBe((await stats()).revenue);       // all paid visits here fall inside the window
    });

    it("builds today's queue: waiting, not arrived, with the doctor, and counts those seen", async () => {
        const t = todayStr();
        const ids: number[] = [];
        for (const [time, status] of [['10:00', 'ONGOING'], ['10:15', 'CHECKED_IN'], ['10:30', 'COMPLETED']] as const) {
            const r: any = await query(`INSERT INTO appointments (patient_id, doctor_id, date, time_slot, queue_number, status) VALUES (?, ?, ?, ?, 1, ?)`, [ALICE, DR, t, time, status]);
            ids.push(r.insertId);
        }
        const { queue } = await (await chart()).json();
        expect(queue.now.time).toBe('10:00');
        expect(queue.waiting.map((w: any) => w.time)).toEqual(['10:15']);
        expect(queue.later.map((w: any) => w.time)).toEqual(['09:00']);        // the pending one from setup
        expect(queue.seen).toBe(1);
        expect(queue.total).toBe(4);                                            // cancelled not counted
        await query(`DELETE FROM appointments WHERE id IN (${ids.join(',')})`);
    });

    it('last 30 days: completion rate counts pending-in-the-past as missed, and reports cancellations', async () => {
        const { lastThirtyDays: l } = await (await chart()).json();
        expect(l.completed).toBe(3);        // -1, -2, -3
        expect(l.missed).toBe(1);           // -4 still pending
        expect(l.completionRate).toBe(75);
    });

    it('a doctor with nothing booked gets empty lists and no rate, not an error', async () => {
        const u: any = await query(`INSERT INTO users (email, password_hash, name, role, is_verified) VALUES (?, 'x', 'Dr. Quiet', 'DOCTOR', TRUE)`, [`quiet.${Date.now()}@dd-test.local`]);
        await query(`INSERT INTO doctors (user_id, specialization, license_number, consultation_fee) VALUES (?, 'GP', ?, 100)`, [u.insertId, `LIC-${u.insertId}`]);
        await as('DOCTOR', u.insertId);
        const { GET } = await import('@/app/api/doctor/overview/route');
        const body = await (await GET()).json();
        expect(body.queue).toMatchObject({ now: null, waiting: [], later: [], seen: 0, total: 0 });
        expect(body.lastThirtyDays.completionRate).toBeNull();
    });

    it('requires the doctor role', async () => {
        await as('PATIENT', ALICE);
        const { GET } = await import('@/app/api/doctor/overview/route');
        expect((await GET()).status).toBe(403);
    });
});
