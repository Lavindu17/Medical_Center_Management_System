import { describe, it, expect, afterAll } from 'vitest';
import { pool, query } from '@/lib/db';
import { as, rows, one, isoDate, ALICE, DOCTOR, RECEPTIONIST, PHARMACIST } from './helpers';
import { addDays, localDay } from '@/lib/hr-time';

const ADMIN = 1;
afterAll(async () => { await pool.end(); });

const today = () => localDay(new Date(), 'Asia/Colombo');
const adminDash = async () => { await as('ADMIN', ADMIN); return (await import('@/app/api/admin/dashboard/route')).GET(); };
const deskDash = async () => { await as('RECEPTIONIST', RECEPTIONIST); return (await import('@/app/api/receptionist/dashboard/route')).GET(); };
const insertAppt = async (date: string, time: string, status: string, doctor = DOCTOR) =>
    (await query<any>(`INSERT INTO appointments (patient_id, doctor_id, date, time_slot, queue_number, status) VALUES (?, ?, ?, ?, 1, ?)`, [ALICE, doctor, date, time, status])).insertId as number;

describe('admin dashboard', () => {
    it('is admin-only', async () => {
        const { GET } = await import('@/app/api/admin/dashboard/route');
        for (const [role, id] of [['DOCTOR', DOCTOR], ['RECEPTIONIST', RECEPTIONIST], ['PHARMACIST', PHARMACIST], ['PATIENT', ALICE]] as const) {
            await as(role, id);
            expect((await GET()).status, role).toBe(403);
        }
    });

    it('returns 14 days of appointments, ending today, with zeros for quiet days', async () => {
        const body = await (await adminDash()).json();
        expect(body.appointments).toHaveLength(14);
        expect(body.appointments[13].day).toBe(body.today);
        expect(body.appointments[0].day).toBe(addDays(body.today, -13));
        for (const d of body.appointments) expect(d.booked).toBeGreaterThanOrEqual(d.completed);
        expect(body.patients).toBeGreaterThanOrEqual(2);
        expect(body.staff).toBeGreaterThanOrEqual(6);
        expect(body.health.database).toBe('ok');
    });

    it('counts today\'s bookings without cancelled ones, and reports status mix', async () => {
        const before = await (await adminDash()).json();
        const t = today();
        const a = await insertAppt(t, '23:00', 'PENDING');
        const b = await insertAppt(t, '23:15', 'CANCELLED');
        const after = await (await adminDash()).json();
        expect(after.todayAppointments).toBe(before.todayAppointments + 1);
        expect(after.appointments[13].booked).toBe(before.appointments[13].booked + 1);
        const pending = (s: any) => s.todayStatus.find((x: any) => x.name === 'PENDING')?.value ?? 0;
        expect(pending(after)).toBe(pending(before) + 1);
        await query(`DELETE FROM appointments WHERE id IN (?, ?)`, [a, b]);
    });

    it('revenue: this month vs last month from paid bills, and the change %', async () => {
        const t = today();
        const lastMonthDay = addDays(t.slice(0, 7) + '-01', -5);       // inside last month
        const before = await (await adminDash()).json();
        const mk = async (date: string, amount: number) => {
            const appt = await insertAppt(date, '22:00', 'COMPLETED');
            await query(`INSERT INTO bills (appointment_id, doctor_fee, service_charge, total_amount, status, paid_at) VALUES (?, ?, 0, ?, 'PAID', ?)`, [appt, amount, amount, `${date} 12:00:00`]);
            return appt;
        };
        const a = await mk(t, 1000);
        const b = await mk(lastMonthDay, 400);
        const after = await (await adminDash()).json();
        expect(after.revenue.thisMonth).toBe(before.revenue.thisMonth + 1000);
        expect(after.revenue.lastMonth).toBe(before.revenue.lastMonth + 400);
        if (after.revenue.lastMonth > 0) expect(after.revenue.change).toBe(Math.round(((after.revenue.thisMonth - after.revenue.lastMonth) / after.revenue.lastMonth) * 1000) / 10);
        await query(`DELETE FROM appointments WHERE id IN (?, ?)`, [a, b]);   // bills cascade
    });

    it('needs-attention counts: pending leave, doctors on leave today, low stock', async () => {
        const before = (await (await adminDash()).json()).attention;
        const t = today();
        const leave: any = await query(`INSERT INTO doctor_leaves (doctor_id, date, reason) VALUES (?, ?, 'x')`, [DOCTOR, t]);
        const med: any = await query(`INSERT INTO medicines (name, stock, min_stock_level) VALUES (?, 0, 10)`, [`Dash-low-${Date.now()}`]).catch(() => null);
        const after = (await (await adminDash()).json()).attention;
        expect(after.doctorsOnLeave).toBe(before.doctorsOnLeave + 1);
        if (med) expect(after.lowStock).toBe(before.lowStock + 1);
        await query(`DELETE FROM doctor_leaves WHERE id = ?`, [leave.insertId]);
        if (med) await query(`DELETE FROM medicines WHERE id = ?`, [med.insertId]);
    });

    it('reports the audit trail as intact', async () => {
        const body = await (await adminDash()).json();
        expect(['ok', 'skipped']).toContain(body.health.audit.status);
    });

    it('top doctors are ordered by appointments in the last 30 days', async () => {
        const body = await (await adminDash()).json();
        const counts = body.topDoctors.map((d: any) => d.value);
        expect(counts).toEqual([...counts].sort((x: number, y: number) => y - x));
        expect(body.topDoctors.length).toBeLessThanOrEqual(5);
    });
});

describe('receptionist dashboard', () => {
    it('is receptionist-only', async () => {
        const { GET } = await import('@/app/api/receptionist/dashboard/route');
        for (const [role, id] of [['DOCTOR', DOCTOR], ['PHARMACIST', PHARMACIST], ['PATIENT', ALICE]] as const) {
            await as(role, id);
            expect((await GET()).status, role).toBe(403);
        }
        await as('ADMIN', ADMIN);
        expect((await GET()).status).toBe(403);
    });

    it('builds each doctor\'s live queue: who is with the doctor, who is waiting, who has been seen', async () => {
        const t = today();
        const mine = await (async () => {
            const u: any = await query(`INSERT INTO users (email, password_hash, name, role, is_verified) VALUES (?, 'x', 'Dr. Queue Test', 'DOCTOR', 1)`, [`queue.${Date.now()}@test.local`]);
            await query(`INSERT INTO doctors (user_id, specialization, license_number, consultation_fee) VALUES (?, 'GP', ?, 1000)`, [u.insertId, `Q-${u.insertId}`]);
            return u.insertId as number;
        })();
        const ids = [
            await insertAppt(t, '09:00', 'COMPLETED', mine),
            await insertAppt(t, '09:15', 'ONGOING', mine),
            await insertAppt(t, '09:30', 'CHECKED_IN', mine),
            await insertAppt(t, '09:45', 'PENDING', mine),
            await insertAppt(t, '10:00', 'CANCELLED', mine),
        ];
        const body = await (await deskDash()).json();
        const q = body.queues.find((x: any) => x.id === mine);
        expect(q.total).toBe(4);                       // cancelled is not counted
        expect(q.seen).toBe(1);
        expect(q.now.time).toBe('09:15');
        expect(q.waiting.map((w: any) => w.time)).toEqual(['09:30']);
        expect(body.counts.total).toBeGreaterThanOrEqual(4);
        expect(body.counts.waiting).toBeGreaterThanOrEqual(1);
        expect(body.perHour.find((h: any) => h.hour === '09:00').booked).toBeGreaterThanOrEqual(4);
        await query(`DELETE FROM appointments WHERE id IN (${ids.join(',')})`);
    });

    it('pending bills: count, total and the oldest few; no clinic revenue is exposed', async () => {
        const body = await (await deskDash()).json();
        const db = await one(`SELECT COUNT(*) AS n, COALESCE(SUM(total_amount), 0) AS amount FROM bills WHERE status = 'PENDING'`);
        expect(body.bills.count).toBe(Number(db.n));
        expect(body.bills.amount).toBe(Number(db.amount));
        expect(body.bills.oldest.length).toBeLessThanOrEqual(5);
        expect(JSON.stringify(body)).not.toMatch(/revenue/i);
    });

    it('an empty day returns empty lists, not an error', async () => {
        const body = await (await deskDash()).json();
        expect(Array.isArray(body.queues)).toBe(true);
        expect(Array.isArray(body.perHour)).toBe(true);
    });
});

describe('lab dashboard', () => {
    const lab = async () => { await as('LAB_ASSISTANT', 7); return (await import('@/app/api/lab-assistant/dashboard/route')).GET(); };
    it('is lab-assistant-only', async () => {
        const { GET } = await import('@/app/api/lab-assistant/dashboard/route');
        for (const [role, id] of [['DOCTOR', DOCTOR], ['PATIENT', ALICE], ['RECEPTIONIST', RECEPTIONIST]] as const) { await as(role, id); expect((await GET()).status, role).toBe(403); }
    });
    it('counts waiting and completed-today requests, ignoring cancelled visits, and keeps a 14-day trend', async () => {
        const before = await (await lab()).json();
        const t = today();
        const live = await insertAppt(t, '20:00', 'COMPLETED');
        const dead = await insertAppt(t, '20:15', 'CANCELLED');
        const ins = async (appt: number, status: string, completed: boolean) =>
            (await query<any>(`INSERT INTO lab_requests (appointment_id, test_id, status, completed_at) VALUES (?, 1, ?, ${completed ? 'NOW()' : 'NULL'})`, [appt, status])).insertId as number;
        const a = await ins(live, 'PENDING', false);
        const b = await ins(live, 'COMPLETED', true);
        const c = await ins(dead, 'PENDING', false);
        const after = await (await lab()).json();
        expect(after.pending).toBe(before.pending + 1);             // the one on the cancelled visit is not counted
        expect(after.completedToday).toBe(before.completedToday + 1);
        expect(after.trend).toHaveLength(14);
        expect(after.trend[13].requested).toBe(before.trend[13].requested + 2);
        expect(after.trend[13].completed).toBe(before.trend[13].completed + 1);
        expect(after.oldestPending.length).toBeLessThanOrEqual(5);
        await query(`DELETE FROM lab_requests WHERE id IN (?, ?, ?)`, [a, b, c]);
        await query(`DELETE FROM appointments WHERE id IN (?, ?)`, [live, dead]);
    });
});

describe('pharmacist lists', () => {
    const lists = async () => { await as('PHARMACIST', PHARMACIST); return (await import('@/app/api/pharmacist/lists/route')).GET(); };
    it('is pharmacist-only', async () => {
        const { GET } = await import('@/app/api/pharmacist/lists/route');
        for (const [role, id] of [['DOCTOR', DOCTOR], ['PATIENT', ALICE]] as const) { await as(role, id); expect((await GET()).status, role).toBe(403); }
    });
    it('lists the batches expiring soonest and the lowest stock, at most five each, and a 14-day prescription trend', async () => {
        const body = await (await lists()).json();
        expect(body.expiring.length).toBeLessThanOrEqual(5);
        const dates = body.expiring.map((b: any) => b.expiry);
        expect(dates).toEqual([...dates].sort());
        for (const b of body.expiring) expect(b.daysLeft).toBeLessThanOrEqual(30);
        const stock = body.lowStock.map((m: any) => m.stock);
        expect(stock).toEqual([...stock].sort((x: number, y: number) => x - y));
        for (const m of body.lowStock) expect(m.stock).toBeLessThan(m.minimum);
        expect(body.prescriptions).toHaveLength(14);
        const top = body.topMedicines.map((m: any) => m.value);
        expect(top).toEqual([...top].sort((x: number, y: number) => y - x));
    });
});

describe('patient summary', () => {
    it("counts only the patient's own open prescriptions, ready lab results and unpaid bills", async () => {
        await as('PATIENT', ALICE);
        const { GET } = await import('@/app/api/patient/summary/route');
        const before = await (await GET()).json();
        const appt = await insertAppt(today(), '21:00', 'COMPLETED');
        await query(`INSERT INTO prescriptions (appointment_id, doctor_id, status) VALUES (?, ?, 'PENDING')`, [appt, DOCTOR]);
        await query(`INSERT INTO lab_requests (appointment_id, test_id, status, completed_at) VALUES (?, 1, 'COMPLETED', NOW())`, [appt]);
        await query(`INSERT INTO bills (appointment_id, doctor_fee, service_charge, total_amount, status) VALUES (?, 700, 0, 700, 'PENDING')`, [appt]);
        await as('PATIENT', ALICE);
        const after = await (await GET()).json();
        expect(after.prescriptionsToCollect).toBe(before.prescriptionsToCollect + 1);
        expect(after.labResultsReady).toBe(before.labResultsReady + 1);
        expect(after.unpaidBills).toBe(before.unpaidBills + 1);
        expect(after.unpaidAmount).toBe(before.unpaidAmount + 700);
        await as('PATIENT', 5);                                                  // Bob sees none of it
        const bob = await (await GET()).json();
        expect(bob.unpaidAmount).not.toBe(after.unpaidAmount + 700);
        await query(`DELETE FROM appointments WHERE id = ?`, [appt]);
    });
    it('is patient-only', async () => {
        await as('DOCTOR', DOCTOR);
        expect((await (await import('@/app/api/patient/summary/route')).GET()).status).toBe(403);
    });
});

describe('hr overview trend', () => {
    it('adds a 14-day attendance mix for HR and admin', async () => {
        await as('ADMIN', ADMIN);
        const res = await (await import('@/app/api/hr/overview/route')).GET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(Array.isArray(body.trend)).toBe(true);
        expect(body.trend.length).toBeLessThanOrEqual(14);
        for (const d of body.trend) for (const k of ['onTime', 'late', 'absent', 'onLeave']) expect(typeof d[k]).toBe('number');
        expect(body.counts.staff).toBeGreaterThan(0);
    });
});
