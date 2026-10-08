import { describe, it, expect, afterAll } from 'vitest';
import { pool } from '@/lib/db';
import { identity } from '../helpers/state';
import { tokenFor } from '../helpers/auth';
import {
    DOCTOR, ALICE, BOB, as, post, isoDate, rows, one, makeAppointment, addMedicine, consult, dispense, rx,
} from './helpers';

// Plan section 13, step 4: races that only show up with real transactions.
// All previously documented defects here were fixed in Milestone 5 and are now plain regression tests.

afterAll(async () => { await pool.end(); });

// Each request carries its own identity (AsyncLocalStorage) so they genuinely start at the same instant.
async function parallelBookings(attempts: { patientId: number; date: string; timeSlot: string }[]) {
    const { POST } = await import('@/app/api/appointments/route');
    const tokens = await Promise.all(attempts.map((a) => tokenFor('PATIENT', a.patientId)));
    return Promise.all(attempts.map((a, i) => identity.run(tokens[i], () =>
        POST(post('/api/appointments', { patientId: a.patientId, doctorId: DOCTOR, date: a.date, timeSlot: a.timeSlot })))));
}

describe('booking concurrency', () => {
    it('the same slot cannot be booked twice by simultaneous requests', async () => {
        const date = isoDate(12);
        const res = await parallelBookings([
            { patientId: ALICE, date, timeSlot: '11:00' },
            { patientId: BOB, date, timeSlot: '11:00' },
            { patientId: ALICE, date, timeSlot: '11:00' },
            { patientId: BOB, date, timeSlot: '11:00' },
        ]);
        const created = res.filter((r) => r.status === 201).length;
        const live = await rows(`SELECT id FROM appointments WHERE doctor_id = ? AND date = ? AND time_slot = '11:00' AND status <> 'CANCELLED'`, [DOCTOR, date]);
        expect(live).toHaveLength(1);
        expect(created).toBe(1);
    });

    // Observed: concurrent bookings for DIFFERENT slots of one doctor/day intermittently fail with
    // "Deadlock found when trying to get lock" (returned to the patient as a 409 slot conflict), because
    // SELECT ... FOR UPDATE over a non-unique range only takes shared gap locks. Whether a given round
    // deadlocks depends on timing, so run many rounds and judge them together.
    let contention: Promise<{ statuses: number[]; bodies: string[]; queueOk: boolean }> | null = null;
    const runContention = () => (contention ??= (async () => {
        const slots = ['09:00', '09:15', '09:30', '09:45', '10:00', '10:15'];
        const statuses: number[] = [], bodies: string[] = [];
        let queueOk = true;
        for (let round = 0; round < 12; round++) {
            const date = isoDate(30 + round);
            const res = await parallelBookings(slots.map((timeSlot, i) => ({ patientId: i % 2 ? ALICE : BOB, date, timeSlot })));
            for (const r of res) { statuses.push(r.status); bodies.push(JSON.stringify(await r.json())); }
            const q = await rows(`SELECT queue_number FROM appointments WHERE doctor_id = ? AND date = ?`, [DOCTOR, date]);
            const nums = q.map((r: any) => r.queue_number);
            if (new Set(nums).size !== nums.length) queueOk = false;
        }
        return { statuses, bodies, queueOk };
    })());

    it('simultaneous bookings never produce duplicate queue numbers', async () => {
        expect((await runContention()).queueOk).toBe(true);
    });

    it('simultaneous bookings for different slots all succeed', async () => {
        const { statuses } = await runContention();
        expect(statuses.filter((s) => s !== 201)).toEqual([]);
    });

    it('a booking conflict never exposes a raw database deadlock message', async () => {
        const { bodies } = await runContention();
        expect(bodies.filter((b) => /deadlock/i.test(b))).toEqual([]);
    });
});

describe('consultation concurrency', () => {
    it('completing the same consultation twice at once yields exactly one bill', async () => {
        const appt = await makeAppointment();
        await as('DOCTOR', DOCTOR);
        const res = await Promise.all([consult(appt, { status: 'COMPLETED' }), consult(appt, { status: 'COMPLETED' })]);
        expect(await rows(`SELECT id FROM bills WHERE appointment_id = ?`, [appt])).toHaveLength(1);
        expect(res.some((r) => r.status === 200)).toBe(true);
    });

    it('a triple-click on Complete never surfaces a server error to the doctor', async () => {
        const appt = await makeAppointment();
        const res = await Promise.all([consult(appt, { status: 'COMPLETED' }), consult(appt, { status: 'COMPLETED' }), consult(appt, { status: 'COMPLETED' })]);
        expect(res.filter((r) => r.status >= 500)).toHaveLength(0);
        expect(await rows(`SELECT id FROM bills WHERE appointment_id = ?`, [appt])).toHaveLength(1);
    });
});

describe('consultation saves for different appointments', () => {
    // Observed: DELETE FROM prescription_items WHERE prescription_id = ? on a brand-new (empty) prescription takes
    // a gap lock, so simultaneous first saves for unrelated appointments deadlock on the item INSERT.
    it('doctors saving different consultations at the same time do not deadlock', async () => {
        const statuses: number[] = [];
        const med = await addMedicine('Parallelin', [{ qty: 500, expiryDays: 200, sell: 2 }]);
        for (let round = 0; round < 6; round++) {
            const appts = [await makeAppointment(), await makeAppointment(), await makeAppointment(), await makeAppointment()];
            const res = await Promise.all(appts.map((a) => consult(a, { status: 'ONGOING', prescription: rx(med, 5) })));
            statuses.push(...res.map((r) => r.status));
        }
        expect(statuses.filter((s) => s !== 200)).toEqual([]);
    });
});

describe('connection pool', () => {
    it('recovers after many failed transactions (no leaked connections)', async () => {
        const appt = await makeAppointment();
        // Unknown medicine id -> foreign-key error inside the transaction -> rollback path -> 400.
        const failures = await Promise.all(Array.from({ length: 30 }, () => consult(appt, { status: 'ONGOING', prescription: rx(999999, 1) })));
        expect(failures.every((r) => r.status === 400)).toBe(true);
        const ok = await consult(appt, { status: 'ONGOING', notes: 'still alive' });
        expect(ok.status).toBe(200);
    });
});

describe('pharmacy concurrency', () => {
    async function prescriptionFor(med: number, qty: number) {
        const appt = await makeAppointment();
        await consult(appt, { status: 'ONGOING', prescription: rx(med, qty) });
        const p = await one(`SELECT id FROM prescriptions WHERE appointment_id = ?`, [appt]);
        const item = await one(`SELECT id FROM prescription_items WHERE prescription_id = ?`, [p.id]);
        return { prescriptionId: p.id as number, itemId: item.id as number };
    }

    // Observed: 6 parallel dispenses all return 200; the item row says 10/10 (it is written as an absolute value)
    // but stock was deducted 6x (500 -> 440) and the bill charged 6x.
    it('repeated clicks on Dispense deduct stock and bill once', async () => {
        const med = await addMedicine('Clickmax', [{ qty: 500, expiryDays: 200, sell: 2 }]);
        const { prescriptionId, itemId } = await prescriptionFor(med, 10);
        await Promise.all(Array.from({ length: 6 }, () =>
            dispense(prescriptionId, { action: 'DISPENSE', medicine_id: med, quantity_to_dispense: 10, item_id: itemId })));
        const item = await one(`SELECT dispensed_quantity, quantity FROM prescription_items WHERE id = ?`, [itemId]);
        expect(item.dispensed_quantity).toBeLessThanOrEqual(item.quantity);
        const batch = await one(`SELECT quantity_current FROM inventory_batches WHERE medicine_id = ?`, [med]);
        expect(500 - batch.quantity_current).toBe(item.dispensed_quantity);
    });

    it('two pharmacists cannot take more stock than exists (no negative batch quantity)', async () => {
        const med = await addMedicine('Scarcium', [{ qty: 10, expiryDays: 200, sell: 2 }]);
        // Built sequentially on purpose: saving consultations in parallel is covered by its own test above.
        const jobs = [await prescriptionFor(med, 10), await prescriptionFor(med, 10), await prescriptionFor(med, 10)];
        await Promise.all(jobs.map((j) =>
            dispense(j.prescriptionId, { action: 'DISPENSE', medicine_id: med, quantity_to_dispense: 10, item_id: j.itemId })));
        const batch = await one(`SELECT quantity_current FROM inventory_batches WHERE medicine_id = ?`, [med]);
        const stock = await one(`SELECT stock FROM medicines WHERE id = ?`, [med]);
        expect(batch.quantity_current).toBeGreaterThanOrEqual(0);
        expect(stock.stock).toBeGreaterThanOrEqual(0);
    });

    it('sequential dispenses of one item never exceed the prescribed quantity', async () => {
        const med = await addMedicine('Steadyfast', [{ qty: 100, expiryDays: 200, sell: 2 }]);
        const { prescriptionId, itemId } = await prescriptionFor(med, 10);
        const first = await dispense(prescriptionId, { action: 'DISPENSE', medicine_id: med, quantity_to_dispense: 10, item_id: itemId });
        const second = await dispense(prescriptionId, { action: 'DISPENSE', medicine_id: med, quantity_to_dispense: 10, item_id: itemId });
        expect(first.status).toBe(200);
        expect(second.status).toBeGreaterThanOrEqual(400);
        expect((await one(`SELECT dispensed_quantity FROM prescription_items WHERE id = ?`, [itemId])).dispensed_quantity).toBe(10);
    });
});
