import { describe, it, expect, afterAll } from 'vitest';
import { pool, query } from '@/lib/db';
import {
    DOCTOR, ALICE, BOB, as, post, ctx, isoDate, rows, one, makeAppointment, addMedicine, consult, dispense, rx,
} from './helpers';

// Plan sections 4, 5 and 7: business rules for booking, consultations and dispensing.

afterAll(async () => { await pool.end(); });

async function prescriptionWith(med: number, qty: number, extra: Record<string, unknown> = {}) {
    const appt = await makeAppointment();
    const res = await consult(appt, { status: 'ONGOING', prescription: rx(med, qty), ...extra });
    expect(res.status).toBe(200);
    const p = await one(`SELECT id FROM prescriptions WHERE appointment_id = ?`, [appt]);
    const item = await one(`SELECT id FROM prescription_items WHERE prescription_id = ?`, [p.id]);
    return { appt, prescriptionId: p.id as number, itemId: item.id as number };
}

describe('booking validation', () => {
    async function book(body: Record<string, unknown>) {
        await as('PATIENT', ALICE);
        const { POST } = await import('@/app/api/appointments/route');
        return POST(post('/api/appointments', { patientId: ALICE, doctorId: DOCTOR, date: isoDate(60), timeSlot: '09:00', ...body }));
    }

    it('rejects a date in the past', async () => {
        expect((await book({ date: isoDate(-1) })).status).toBe(400);
    });

    it('rejects malformed or impossible time slots', async () => {
        for (const timeSlot of ['abc', '9:00', '25:00', '09:60', '09:00:00', '']) {
            expect((await book({ timeSlot })).status, timeSlot).toBe(400);
        }
    });

    it('rejects an unknown doctor', async () => {
        expect((await book({ doctorId: 999999 })).status).toBe(404);
    });

    it('refuses a day the doctor is on leave', async () => {
        const date = isoDate(61);
        await query(`INSERT INTO doctor_leaves (doctor_id, date, reason) VALUES (?, ?, 'conference')`, [DOCTOR, date]);
        const res = await book({ date });
        expect(res.status).toBe(409);
        expect((await res.json()).message).toMatch(/not available/i);
    });

    it('allows the slot again once the earlier booking is cancelled', async () => {
        const date = isoDate(62);
        const first = await book({ date, timeSlot: '13:00' });
        expect(first.status).toBe(201);
        await query(`UPDATE appointments SET status = 'CANCELLED' WHERE doctor_id = ? AND date = ? AND time_slot = '13:00'`, [DOCTOR, date]);
        expect((await book({ date, timeSlot: '13:00' })).status).toBe(201);
    });
});

describe('consultation rules', () => {
    it.each(['CANCELLED', 'ABSENT', 'NO_SHOW'])('cannot consult a %s appointment', async (state) => {
        const appt = await makeAppointment(ALICE, state);
        expect((await consult(appt, { status: 'ONGOING' })).status).toBe(409);
        expect((await consult(appt, { status: 'COMPLETED' })).status).toBe(409);
        expect(await rows(`SELECT id FROM bills WHERE appointment_id = ?`, [appt])).toHaveLength(0);
    });

    it('a completed consultation cannot be reopened as a draft', async () => {
        const appt = await makeAppointment();
        expect((await consult(appt, { status: 'COMPLETED' })).status).toBe(200);
        expect((await consult(appt, { status: 'ONGOING' })).status).toBe(409);
        expect((await one(`SELECT status FROM appointments WHERE id = ?`, [appt])).status).toBe('COMPLETED');
    });

    it('the doctor fee is a snapshot taken when the bill is created', async () => {
        const appt = await makeAppointment();
        await consult(appt, { status: 'COMPLETED' });
        await query(`UPDATE doctors SET consultation_fee = 9999 WHERE user_id = ?`, [DOCTOR]);
        try {
            await consult(appt, { status: 'COMPLETED' });
            expect(Number((await one(`SELECT doctor_fee FROM bills WHERE appointment_id = ?`, [appt])).doctor_fee)).toBe(2500);
        } finally {
            await query(`UPDATE doctors SET consultation_fee = 2500 WHERE user_id = ?`, [DOCTOR]);
        }
    });

    it('a lab request added after completion is reflected when the consultation is saved again', async () => {
        const appt = await makeAppointment();
        await consult(appt, { status: 'COMPLETED' });
        expect(Number((await one(`SELECT lab_total FROM bills WHERE appointment_id = ?`, [appt])).lab_total)).toBe(0);
        await consult(appt, { status: 'COMPLETED', labRequestIds: [1, 2] });
        const bill = await one(`SELECT lab_total, total_amount FROM bills WHERE appointment_id = ?`, [appt]);
        expect(Number(bill.lab_total)).toBe(850 + 400);
        expect(Number(bill.total_amount)).toBe(2500 + 500 + 1250);
    });

    it('lab requests are de-duplicated', async () => {
        const appt = await makeAppointment();
        await consult(appt, { status: 'ONGOING', labRequestIds: [1, 1, 1] });
        await consult(appt, { status: 'ONGOING', labRequestIds: [1] });
        expect(await rows(`SELECT id FROM lab_requests WHERE appointment_id = ?`, [appt])).toHaveLength(1);
    });

    it('zero is accepted as a vital sign and stored (not turned into NULL)', async () => {
        const appt = await makeAppointment();
        await consult(appt, { status: 'ONGOING', vitals: { weight: 0, pulse: 0 } });
        const a = await one(`SELECT weight, pulse FROM appointments WHERE id = ?`, [appt]);
        expect(Number(a.weight)).toBe(0);
        expect(a.pulse).toBe(0);
    });

    it('rejects invalid input with 400 and leaves the appointment untouched', async () => {
        const appt = await makeAppointment();
        const bad: Record<string, unknown>[] = [
            { vitals: { weight: 'heavy' } },
            { vitals: { pulse: -5 } },
            { prescription: 'aspirin' },
            { prescription: [{ medicineId: 1, dosage: '1', frequency: '1-0-0-0', duration: '5 days', quantity: 0 }] },
            { prescription: [{ medicineId: 1, dosage: '', frequency: '1-0-0-0', duration: '5 days', quantity: 3 }] },
            { prescription: [{ medicineId: 'x', dosage: '1', frequency: 'a', duration: 'b', quantity: 3 }] },
            { labRequestIds: 'all' },
            { labRequestIds: [0] },
        ];
        for (const b of bad) {
            expect((await consult(appt, { status: 'ONGOING', notes: 'should not persist', ...b })).status, JSON.stringify(b)).toBe(400);
        }
        expect((await one(`SELECT notes, status FROM appointments WHERE id = ?`, [appt])).notes).toBeNull();
        expect(await rows(`SELECT id FROM prescriptions WHERE appointment_id = ?`, [appt])).toHaveLength(0);
    });

    it('an unknown medicine rolls the whole save back', async () => {
        const appt = await makeAppointment();
        const res = await consult(appt, { status: 'COMPLETED', notes: 'x', prescription: rx(999999, 1) });
        expect(res.status).toBe(400);
        expect((await one(`SELECT status FROM appointments WHERE id = ?`, [appt])).status).toBe('PENDING');
        expect(await rows(`SELECT id FROM bills WHERE appointment_id = ?`, [appt])).toHaveLength(0);
    });
});

describe('prescription editing after dispensing', () => {
    it('re-saving the same prescription keeps what was dispensed and the item status', async () => {
        const med = await addMedicine('Editable', [{ qty: 100, expiryDays: 200, sell: 3 }]);
        const { appt, prescriptionId, itemId } = await prescriptionWith(med, 10);
        await dispense(prescriptionId, { action: 'DISPENSE', quantity_to_dispense: 4, item_id: itemId });
        expect((await consult(appt, { status: 'ONGOING', prescription: rx(med, 10) })).status).toBe(200);
        expect(await one(`SELECT status, dispensed_quantity, quantity FROM prescription_items WHERE id = ?`, [itemId]))
            .toMatchObject({ status: 'PARTIALLY_COMPLETED', dispensed_quantity: 4, quantity: 10 });
    });

    it('raising the quantity of a fully dispensed item makes it partially dispensed again', async () => {
        const med = await addMedicine('Topup', [{ qty: 100, expiryDays: 200, sell: 3 }]);
        const { appt, prescriptionId, itemId } = await prescriptionWith(med, 5);
        await dispense(prescriptionId, { action: 'DISPENSE', quantity_to_dispense: 5, item_id: itemId });
        expect((await one(`SELECT status FROM prescriptions WHERE id = ?`, [prescriptionId])).status).toBe('COMPLETED');
        await consult(appt, { status: 'ONGOING', prescription: rx(med, 8) });
        expect(await one(`SELECT status, dispensed_quantity FROM prescription_items WHERE id = ?`, [itemId]))
            .toMatchObject({ status: 'PARTIALLY_COMPLETED', dispensed_quantity: 5 });
        expect((await one(`SELECT status FROM prescriptions WHERE id = ?`, [prescriptionId])).status).toBe('PARTIALLY_COMPLETED');
    });

    it('the quantity cannot be reduced below what has been dispensed', async () => {
        const med = await addMedicine('Floor', [{ qty: 100, expiryDays: 200, sell: 3 }]);
        const { appt, prescriptionId, itemId } = await prescriptionWith(med, 10);
        await dispense(prescriptionId, { action: 'DISPENSE', quantity_to_dispense: 6, item_id: itemId });
        expect((await consult(appt, { status: 'ONGOING', prescription: rx(med, 3) })).status).toBe(409);
    });

    it('a dispensed medicine cannot be dropped, but an untouched one can', async () => {
        const kept = await addMedicine('Kept', [{ qty: 100, expiryDays: 200, sell: 3 }]);
        const dropped = await addMedicine('Dropped', [{ qty: 100, expiryDays: 200, sell: 3 }]);
        const appt = await makeAppointment();
        await consult(appt, { status: 'ONGOING', prescription: [...rx(kept, 5), ...rx(dropped, 5)] });
        const p = await one(`SELECT id FROM prescriptions WHERE appointment_id = ?`, [appt]);
        const keptItem = await one(`SELECT id FROM prescription_items WHERE prescription_id = ? AND medicine_id = ?`, [p.id, kept]);

        // Removing only the untouched medicine is fine
        expect((await consult(appt, { status: 'ONGOING', prescription: rx(kept, 5) })).status).toBe(200);
        expect(await rows(`SELECT id FROM prescription_items WHERE prescription_id = ?`, [p.id])).toHaveLength(1);

        await dispense(p.id, { action: 'DISPENSE', quantity_to_dispense: 5, item_id: keptItem.id });
        // Removing the dispensed one is not
        expect((await consult(appt, { status: 'ONGOING', prescription: rx(dropped, 5) })).status).toBe(409);
        expect(await rows(`SELECT id FROM prescription_items WHERE id = ?`, [keptItem.id])).toHaveLength(1);
    });

    it('adding a medicine to a completed prescription reopens it for the pharmacist', async () => {
        const a = await addMedicine('First', [{ qty: 50, expiryDays: 200, sell: 3 }]);
        const b = await addMedicine('Second', [{ qty: 50, expiryDays: 200, sell: 3 }]);
        const { appt, prescriptionId, itemId } = await prescriptionWith(a, 5);
        await dispense(prescriptionId, { action: 'DISPENSE', quantity_to_dispense: 5, item_id: itemId });
        await consult(appt, { status: 'ONGOING', prescription: [...rx(a, 5), ...rx(b, 5)] });
        expect((await one(`SELECT status FROM prescriptions WHERE id = ?`, [prescriptionId])).status).toBe('PARTIALLY_COMPLETED');
    });
});

describe('dispensing rules', () => {
    it('rejects non-positive, fractional and non-numeric quantities', async () => {
        const med = await addMedicine('Quantity', [{ qty: 100, expiryDays: 200, sell: 3 }]);
        const { prescriptionId, itemId } = await prescriptionWith(med, 10);
        for (const q of [0, -5, 2.5, 'abc', null, undefined]) {
            const res = await dispense(prescriptionId, { action: 'DISPENSE', quantity_to_dispense: q, item_id: itemId });
            expect(res.status, String(q)).toBe(400);
        }
        expect((await one(`SELECT dispensed_quantity FROM prescription_items WHERE id = ?`, [itemId])).dispensed_quantity).toBe(0);
        expect((await one(`SELECT quantity_current FROM inventory_batches WHERE medicine_id = ?`, [med])).quantity_current).toBe(100);
    });

    it('an item of another prescription cannot be dispensed through this one', async () => {
        const med = await addMedicine('Mixup', [{ qty: 100, expiryDays: 200, sell: 3 }]);
        const first = await prescriptionWith(med, 10);
        const second = await prescriptionWith(med, 10);
        const res = await dispense(first.prescriptionId, { action: 'DISPENSE', quantity_to_dispense: 5, item_id: second.itemId });
        expect(res.status).toBe(404);
        expect((await one(`SELECT dispensed_quantity FROM prescription_items WHERE id = ?`, [second.itemId])).dispensed_quantity).toBe(0);
    });

    it('stock is deducted for the prescribed medicine even if the client names another', async () => {
        const prescribed = await addMedicine('Prescribed', [{ qty: 100, expiryDays: 200, sell: 3 }]);
        const other = await addMedicine('Other', [{ qty: 100, expiryDays: 200, sell: 3 }]);
        const { prescriptionId, itemId } = await prescriptionWith(prescribed, 10);
        const res = await dispense(prescriptionId, { action: 'DISPENSE', medicine_id: other, quantity_to_dispense: 5, item_id: itemId });
        expect(res.status).toBe(400);
        expect((await one(`SELECT quantity_current FROM inventory_batches WHERE medicine_id = ?`, [other])).quantity_current).toBe(100);
        expect((await one(`SELECT quantity_current FROM inventory_batches WHERE medicine_id = ?`, [prescribed])).quantity_current).toBe(100);
    });

    it('unknown prescription and malformed ids are handled without a 500', async () => {
        expect((await dispense(999999, { action: 'DISPENSE', quantity_to_dispense: 1, item_id: 1 })).status).toBe(404);
        expect((await dispense(1, { action: 'DISPENSE', quantity_to_dispense: 1 })).status).toBe(400);
        expect((await dispense(1, { action: 'EXPLODE', quantity_to_dispense: 1, item_id: 1 })).status).toBe(400);
        await as('PHARMACIST', 6);
        const { POST } = await import('@/app/api/pharmacist/dispense/[id]/route');
        expect((await POST(post('/x', { item_id: 1, quantity_to_dispense: 1 }), ctx('abc'))).status).toBe(400);
    });

    it('never dispenses expired stock, and tells the pharmacist when only expired stock is left', async () => {
        const med = await addMedicine('Stale', [{ qty: 50, expiryDays: -10, sell: 3 }]);
        const { prescriptionId, itemId } = await prescriptionWith(med, 5);
        const res = await dispense(prescriptionId, { action: 'DISPENSE', quantity_to_dispense: 5, item_id: itemId });
        expect(res.status).toBe(409);
        expect((await res.json()).message).toMatch(/insufficient/i);
        expect((await one(`SELECT quantity_current FROM inventory_batches WHERE medicine_id = ?`, [med])).quantity_current).toBe(50);
    });

    it('skips an expired batch and uses the next valid one', async () => {
        const med = await addMedicine('Mixed', [{ qty: 20, expiryDays: -5, sell: 1 }, { qty: 20, expiryDays: 100, sell: 4 }]);
        const { prescriptionId, itemId } = await prescriptionWith(med, 5);
        expect((await dispense(prescriptionId, { action: 'DISPENSE', quantity_to_dispense: 5, item_id: itemId })).status).toBe(200);
        const [expired, valid] = await rows(`SELECT quantity_current FROM inventory_batches WHERE medicine_id = ? ORDER BY expiry_date`, [med]);
        expect(expired.quantity_current).toBe(20);
        expect(valid.quantity_current).toBe(15);
    });

    it('a partial dispense leaves the item and prescription partially complete and bills only what was given', async () => {
        const med = await addMedicine('Partial', [{ qty: 100, expiryDays: 200, sell: 5 }]);
        const { appt, prescriptionId, itemId } = await prescriptionWith(med, 10);
        await consult(appt, { status: 'COMPLETED', prescription: rx(med, 10) });
        const res = await dispense(prescriptionId, { action: 'DISPENSE', quantity_to_dispense: 4, item_id: itemId });
        expect((await res.json()).prescription_status).toBe('PARTIALLY_COMPLETED');
        expect(await one(`SELECT status, dispensed_quantity, dispensed_amount FROM prescription_items WHERE id = ?`, [itemId]))
            .toMatchObject({ status: 'PARTIALLY_COMPLETED', dispensed_quantity: 4 });
        expect(Number((await one(`SELECT pharmacy_total FROM bills WHERE appointment_id = ?`, [appt])).pharmacy_total)).toBe(20);
        await dispense(prescriptionId, { action: 'DISPENSE', quantity_to_dispense: 6, item_id: itemId });
        const bill = await one(`SELECT pharmacy_total, total_amount, doctor_fee, service_charge, lab_total FROM bills WHERE appointment_id = ?`, [appt]);
        expect(Number(bill.pharmacy_total)).toBe(50);
        expect(Number(bill.total_amount)).toBe(Number(bill.doctor_fee) + Number(bill.service_charge) + Number(bill.lab_total) + 50);
    });

    it('rejecting every item completes the prescription instead of leaving it stuck', async () => {
        const med = await addMedicine('Rejectable', [{ qty: 10, expiryDays: 200, sell: 5 }]);
        const { prescriptionId, itemId } = await prescriptionWith(med, 3);
        const res = await dispense(prescriptionId, { action: 'REJECT', reason: 'OUT_OF_STOCK', item_id: itemId });
        expect(res.status).toBe(200);
        expect((await res.json()).prescription_status).toBe('COMPLETED');
        expect((await one(`SELECT rejection_reason FROM prescription_items WHERE id = ?`, [itemId])).rejection_reason).toBe('OUT_OF_STOCK');
    });

    it('requires a valid rejection reason and cannot reject or dispense a finished item', async () => {
        const med = await addMedicine('Finished', [{ qty: 10, expiryDays: 200, sell: 5 }]);
        const { prescriptionId, itemId } = await prescriptionWith(med, 3);
        expect((await dispense(prescriptionId, { action: 'REJECT', reason: 'BECAUSE', item_id: itemId })).status).toBe(400);
        expect((await dispense(prescriptionId, { action: 'REJECT', item_id: itemId })).status).toBe(400);
        await dispense(prescriptionId, { action: 'DISPENSE', quantity_to_dispense: 3, item_id: itemId });
        expect((await dispense(prescriptionId, { action: 'REJECT', reason: 'OUT_OF_STOCK', item_id: itemId })).status).toBe(409);
        expect((await dispense(prescriptionId, { action: 'DISPENSE', quantity_to_dispense: 1, item_id: itemId })).status).toBe(409);
    });

    it('a partly dispensed item can have its remainder rejected and keeps the charge for what was given', async () => {
        const med = await addMedicine('Remainder', [{ qty: 10, expiryDays: 200, sell: 5 }]);
        const { appt, prescriptionId, itemId } = await prescriptionWith(med, 6);
        await consult(appt, { status: 'COMPLETED', prescription: rx(med, 6) });
        await dispense(prescriptionId, { action: 'DISPENSE', quantity_to_dispense: 2, item_id: itemId });
        const res = await dispense(prescriptionId, { action: 'REJECT', reason: 'OUT_OF_STOCK', item_id: itemId });
        expect(res.status).toBe(200);
        expect(await one(`SELECT status, dispensed_quantity FROM prescription_items WHERE id = ?`, [itemId])).toMatchObject({ status: 'REJECTED', dispensed_quantity: 2 });
        expect(Number((await one(`SELECT pharmacy_total FROM bills WHERE appointment_id = ?`, [appt])).pharmacy_total)).toBe(10);
    });

    it('dispensing after the bill is PAID leaves the closed bill unchanged', async () => {
        const med = await addMedicine('Latecomer', [{ qty: 10, expiryDays: 200, sell: 5 }]);
        const { appt, prescriptionId, itemId } = await prescriptionWith(med, 2);
        await consult(appt, { status: 'COMPLETED', prescription: rx(med, 2) });
        await query(`UPDATE bills SET status = 'PAID', paid_at = NOW() WHERE appointment_id = ?`, [appt]);
        const before = await one(`SELECT pharmacy_total, total_amount FROM bills WHERE appointment_id = ?`, [appt]);
        expect((await dispense(prescriptionId, { action: 'DISPENSE', quantity_to_dispense: 2, item_id: itemId })).status).toBe(200);
        expect(await one(`SELECT pharmacy_total, total_amount FROM bills WHERE appointment_id = ?`, [appt])).toEqual(before);
        expect(Number((await one(`SELECT dispensed_amount FROM prescription_items WHERE id = ?`, [itemId])).dispensed_amount)).toBe(10);
    });
});
