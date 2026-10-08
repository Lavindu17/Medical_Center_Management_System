import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool, query } from '@/lib/db';
import {
    DOCTOR, ALICE, BOB, PHARMACIST, RECEPTIONIST, FBC_LAB_TEST,
    as, post, ctx, isoDate, daysFromNow, rows, one, makeAppointment, addMedicine, consult, dispense, rx,
} from './helpers';

// Plan section 13, step 3: book -> check-in -> consult/complete -> dispense -> bill reconciled.
// Seed users from full_setup.sql: 2 Dr Smith (fee 2500), 4 Alice, 5 Bob, 6 pharmacist, 8 receptionist.
// Tests marked `it.fails` would document a defect that is still present; none remain here.

afterAll(async () => { await pool.end(); });

describe('schema (full_setup.sql + 18_schema_sync.sql)', () => {
    it('contains every column the application code relies on', async () => {
        const need: Record<string, string[]> = {
            prescription_items: ['status', 'dispensed_quantity', 'rejection_reason'],
            bills: ['payment_method', 'paid_by'],
            lab_tests: ['cost_price'],
        };
        for (const [table, cols] of Object.entries(need)) {
            const found = (await rows(
                `SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [table])).map((r: any) => r.c);
            for (const c of cols) expect(found, `${table}.${c}`).toContain(c);
        }
    });

    it('18_schema_sync.sql is idempotent', async () => {
        const fs = await import('fs'); const path = await import('path');
        const sql = fs.readFileSync(path.resolve(__dirname, '../../mydocumentations/databas_setup_querries/18_schema_sync.sql'), 'utf8');
        const conn = await pool.getConnection();
        try { await conn.query(sql); await conn.query(sql); } finally { conn.release(); }
    });

    it('seeded demo accounts are verified so they can log in', async () => {
        const unverified = await rows(`SELECT email FROM users WHERE is_verified = 0 AND id <= 8`);
        expect(unverified).toEqual([]);
    });
});

describe('happy path: appointment -> consultation -> bill -> dispense', () => {
    let apptId: number, medId: number, prescriptionId: number, itemId: number;

    beforeAll(async () => {
        // Two batches: the earlier-expiring one must be consumed first (FEFO).
        medId = await addMedicine('Flowcillin', [{ qty: 40, expiryDays: 60, sell: 6 }, { qty: 100, expiryDays: 400, sell: 7 }]);
    });

    it('patient books a slot and gets queue number 1', async () => {
        await as('PATIENT', ALICE);
        const { POST } = await import('@/app/api/appointments/route');
        const res = await POST(post('/api/appointments', { patientId: ALICE, doctorId: DOCTOR, date: isoDate(1), timeSlot: '10:00', reason: 'Cough' }));
        expect(res.status).toBe(201);
        expect((await res.json()).appointment.queueNumber).toBe(1);
        apptId = (await one(`SELECT id FROM appointments WHERE patient_id = ? AND date = ? AND time_slot = '10:00'`, [ALICE, isoDate(1)])).id;
    });

    it('double-booking the same slot is refused', async () => {
        await as('PATIENT', BOB);
        const { POST } = await import('@/app/api/appointments/route');
        const res = await POST(post('/api/appointments', { patientId: BOB, doctorId: DOCTOR, date: isoDate(1), timeSlot: '10:00' }));
        expect(res.status).toBe(409);
    });

    it('second patient on the same day gets the next queue number', async () => {
        await as('PATIENT', BOB);
        const { POST } = await import('@/app/api/appointments/route');
        const res = await POST(post('/api/appointments', { patientId: BOB, doctorId: DOCTOR, date: isoDate(1), timeSlot: '10:15' }));
        expect(res.status).toBe(201);
        expect((await res.json()).appointment.queueNumber).toBe(2);
    });

    it('receptionist checks the patient in', async () => {
        await as('RECEPTIONIST', RECEPTIONIST);
        const { PUT } = await import('@/app/api/receptionist/appointments/[id]/status/route');
        const res = await PUT(post(`/x`, { status: 'CHECKED_IN' }, 'PUT'), { params: Promise.resolve({ id: String(apptId) }) });
        expect(res.status).toBe(200);
        expect((await one(`SELECT status FROM appointments WHERE id = ?`, [apptId])).status).toBe('CHECKED_IN');
    });

    it('doctor saves a draft with vitals, prescription and a lab request (no bill yet)', async () => {
        const res = await consult(apptId, {
            status: 'ONGOING', vitals: { weight: 60, blood_pressure: '120/80', temperature: 37.2, pulse: 72 },
            prescription: rx(medId, 50), labRequestIds: [FBC_LAB_TEST],
        });
        expect(res.status).toBe(200);
        const appt = await one(`SELECT status, weight, blood_pressure, pulse FROM appointments WHERE id = ?`, [apptId]);
        expect(appt.status).toBe('ONGOING');
        expect(Number(appt.weight)).toBe(60);
        expect(await rows(`SELECT id FROM bills WHERE appointment_id = ?`, [apptId])).toHaveLength(0);
        const p = await one(`SELECT id, status FROM prescriptions WHERE appointment_id = ?`, [apptId]);
        prescriptionId = p.id;
        expect(p.status).toBe('PENDING');
        itemId = (await one(`SELECT id FROM prescription_items WHERE prescription_id = ?`, [prescriptionId])).id;
        expect(await rows(`SELECT id FROM lab_requests WHERE appointment_id = ?`, [apptId])).toHaveLength(1);
    });

    it('completing creates a bill: fee + 500 service + labs, pharmacy 0', async () => {
        const res = await consult(apptId, { status: 'COMPLETED', prescription: rx(medId, 50), labRequestIds: [FBC_LAB_TEST] });
        expect(res.status).toBe(200);
        const b = await one(`SELECT * FROM bills WHERE appointment_id = ?`, [apptId]);
        expect(Number(b.doctor_fee)).toBe(2500);
        expect(Number(b.service_charge)).toBe(500);
        expect(Number(b.lab_total)).toBe(850);
        expect(Number(b.pharmacy_total)).toBe(0);
        expect(Number(b.total_amount)).toBe(3850);
        expect(b.status).toBe('PENDING');
    });

    it('completing twice does not duplicate the bill or lab requests', async () => {
        await consult(apptId, { status: 'COMPLETED', prescription: rx(medId, 50), labRequestIds: [FBC_LAB_TEST] });
        expect(await rows(`SELECT id FROM bills WHERE appointment_id = ?`, [apptId])).toHaveLength(1);
        expect(await rows(`SELECT id FROM lab_requests WHERE appointment_id = ?`, [apptId])).toHaveLength(1);
        itemId = (await one(`SELECT id FROM prescription_items WHERE prescription_id = ?`, [prescriptionId])).id;
    });

    it('pharmacist dispenses FEFO across two batches and the bill picks up the pharmacy cost', async () => {
        const res = await dispense(prescriptionId, { action: 'DISPENSE', medicine_id: medId, quantity_to_dispense: 50, item_id: itemId });
        expect(res.status).toBe(200);
        expect((await res.json()).prescription_status).toBe('COMPLETED');

        const [b1, b2] = await rows(`SELECT quantity_current FROM inventory_batches WHERE medicine_id = ? ORDER BY expiry_date`, [medId]);
        expect(b1.quantity_current).toBe(0);     // 40 taken from the earliest-expiring batch
        expect(b2.quantity_current).toBe(90);    // remaining 10 from the second

        const item = await one(`SELECT status, dispensed_quantity FROM prescription_items WHERE id = ?`, [itemId]);
        expect(item).toMatchObject({ status: 'DISPENSED', dispensed_quantity: 50 });

        const b = await one(`SELECT * FROM bills WHERE appointment_id = ?`, [apptId]);
        expect(Number(b.pharmacy_total)).toBe(40 * 6 + 10 * 7); // 310
        expect(Number(b.total_amount)).toBe(3850 + 310);
    });

    it('reconciliation: stock equals the sum of batches and the bill total equals its parts', async () => {
        // Scoped to this flow's own data: other test files create deliberately racy data in the same schema.
        const med = await one(`SELECT m.stock, COALESCE(SUM(b.quantity_current), 0) AS batches
            FROM medicines m LEFT JOIN inventory_batches b ON b.medicine_id = m.id WHERE m.id = ? GROUP BY m.id`, [medId]);
        expect(Number(med.stock)).toBe(Number(med.batches));
        expect(Number(med.stock)).toBe(90);
        const bill = await one(`SELECT doctor_fee, service_charge, lab_total, pharmacy_total, total_amount FROM bills WHERE appointment_id = ?`, [apptId]);
        expect(Number(bill.total_amount)).toBeCloseTo(Number(bill.doctor_fee) + Number(bill.service_charge) + Number(bill.lab_total) + Number(bill.pharmacy_total), 2);
        expect(await rows(`SELECT id FROM inventory_batches WHERE medicine_id = ? AND quantity_current < 0`, [medId])).toEqual([]);
        expect(await rows(`SELECT id FROM prescription_items WHERE prescription_id = ? AND (dispensed_quantity < 0 OR dispensed_quantity > quantity)`, [prescriptionId])).toEqual([]);
    });
});

describe('receptionist booking', () => {
    it('receptionist-created appointments get sequential queue numbers per doctor and day', async () => {
        await as('RECEPTIONIST', RECEPTIONIST);
        const { POST } = await import('@/app/api/receptionist/appointments/create/route');
        const date = isoDate(5);
        await POST(post('/x', { patient_id: ALICE, doctor_id: DOCTOR, date, time_slot: '09:00' }));
        const res = await POST(post('/x', { patient_id: BOB, doctor_id: DOCTOR, date, time_slot: '09:15' }));
        expect((await res.json()).queue_number).toBe(2);
    });
});

describe('regressions fixed in Milestone 5 (previously documented defects)', () => {
    it('a fully emptied batch is marked DEPLETED', async () => {
        const med = await addMedicine('Depletium', [{ qty: 10, expiryDays: 90, sell: 4 }]);
        const appt = await makeAppointment(); await consult(appt, { status: 'ONGOING', prescription: rx(med, 10) });
        const p = await one(`SELECT id FROM prescriptions WHERE appointment_id = ?`, [appt]);
        const it_ = await one(`SELECT id FROM prescription_items WHERE prescription_id = ?`, [p.id]);
        await dispense(p.id, { action: 'DISPENSE', medicine_id: med, quantity_to_dispense: 10, item_id: it_.id });
        const batch = await one(`SELECT quantity_current, status FROM inventory_batches WHERE medicine_id = ?`, [med]);
        expect(batch).toMatchObject({ quantity_current: 0, status: 'DEPLETED' });
    });

    it('a batch that still has stock stays ACTIVE (remaining == taken case)', async () => {
        const med = await addMedicine('Halfpill', [{ qty: 20, expiryDays: 90, sell: 4 }]);
        const appt = await makeAppointment(); await consult(appt, { status: 'ONGOING', prescription: rx(med, 10) });
        const p = await one(`SELECT id FROM prescriptions WHERE appointment_id = ?`, [appt]);
        const it_ = await one(`SELECT id FROM prescription_items WHERE prescription_id = ?`, [p.id]);
        await dispense(p.id, { action: 'DISPENSE', medicine_id: med, quantity_to_dispense: 10, item_id: it_.id });
        const batch = await one(`SELECT quantity_current, status FROM inventory_batches WHERE medicine_id = ?`, [med]);
        expect(batch).toMatchObject({ quantity_current: 10, status: 'ACTIVE' });
    });

    it('dispensing before the doctor completes the consultation still ends up billed', async () => {
        const med = await addMedicine('Earlybird', [{ qty: 50, expiryDays: 90, sell: 10 }]);
        const appt = await makeAppointment(); await consult(appt, { status: 'ONGOING', prescription: rx(med, 5) });
        const p = await one(`SELECT id FROM prescriptions WHERE appointment_id = ?`, [appt]);
        const it_ = await one(`SELECT id FROM prescription_items WHERE prescription_id = ?`, [p.id]);
        await dispense(p.id, { action: 'DISPENSE', medicine_id: med, quantity_to_dispense: 5, item_id: it_.id });
        await consult(appt, { status: 'COMPLETED', prescription: rx(med, 5) });
        const bill = await one(`SELECT pharmacy_total, total_amount, doctor_fee, service_charge, lab_total FROM bills WHERE appointment_id = ?`, [appt]);
        expect(Number(bill.pharmacy_total)).toBe(50);
    });

    it('re-saving a consultation keeps what the pharmacist already dispensed', async () => {
        const med = await addMedicine('Keepsake', [{ qty: 50, expiryDays: 90, sell: 10 }]);
        const appt = await makeAppointment(); await consult(appt, { status: 'ONGOING', prescription: rx(med, 5) });
        const p = await one(`SELECT id FROM prescriptions WHERE appointment_id = ?`, [appt]);
        const it_ = await one(`SELECT id FROM prescription_items WHERE prescription_id = ?`, [p.id]);
        await dispense(p.id, { action: 'DISPENSE', medicine_id: med, quantity_to_dispense: 5, item_id: it_.id });
        await consult(appt, { status: 'COMPLETED', prescription: rx(med, 5) });
        const item = await one(`SELECT status, dispensed_quantity FROM prescription_items WHERE prescription_id = ?`, [p.id]);
        expect(item).toMatchObject({ status: 'DISPENSED', dispensed_quantity: 5 });
    });

    it('re-saving a consultation does not alter a bill that is already PAID', async () => {
        const appt = await makeAppointment(); await consult(appt, { status: 'COMPLETED' });
        await query(`UPDATE bills SET status = 'PAID', paid_at = NOW() WHERE appointment_id = ?`, [appt]);
        await query(`UPDATE doctors SET consultation_fee = 3000 WHERE user_id = ?`, [DOCTOR]);
        try {
            await consult(appt, { status: 'COMPLETED' });
            const bill = await one(`SELECT doctor_fee FROM bills WHERE appointment_id = ?`, [appt]);
            expect(Number(bill.doctor_fee)).toBe(2500);
        } finally {
            await query(`UPDATE doctors SET consultation_fee = 2500 WHERE user_id = ?`, [DOCTOR]);
        }
    });

    it('an appointment that was cancelled cannot be completed and billed', async () => {
        const appt = await makeAppointment(ALICE, 'CANCELLED');
        await consult(appt, { status: 'COMPLETED' });
        expect(await rows(`SELECT id FROM bills WHERE appointment_id = ?`, [appt])).toHaveLength(0);
    });

});
