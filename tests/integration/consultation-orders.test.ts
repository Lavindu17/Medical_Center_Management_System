import { describe, it, expect, afterAll } from 'vitest';
import { pool, query } from '@/lib/db';
import { ALICE, BOB, DOCTOR, as, ctx, one, rows, makeAppointment, addMedicine, consult, dispense } from './helpers';

// Medicine and lab ordering on the consultation screen: what is saved shows up again when the draft is reopened, the list
// sent is the whole order, allergies stop a prescription until confirmed, and the catalogue reports usable stock.
afterAll(async () => { await pool.end(); });

const line = (medicineId: number, over: Record<string, unknown> = {}) => ({ medicineId, dosage: '1', frequency: '1-0-0-1', duration: '5 days', quantity: 10, ...over });
const open = async (appt: number) => {
    await as('DOCTOR', DOCTOR);
    const { GET } = await import('@/app/api/doctor/consultation/[id]/route');
    return (await GET(new Request('http://x'), ctx(appt))).json();
};
const items = (appt: number) => rows(`SELECT pi.medicine_id AS medicineId FROM prescription_items pi JOIN prescriptions p ON p.id = pi.prescription_id WHERE p.appointment_id = ? ORDER BY pi.id`, [appt]);
const labs = (appt: number) => rows(`SELECT test_id AS testId, status FROM lab_requests WHERE appointment_id = ? ORDER BY test_id`, [appt]);

describe('reopening a draft', () => {
    it('returns the saved medicines, lab tests and the patient\'s allergies', async () => {
        const med = await addMedicine(`Reopen-${Date.now()}`, [{ qty: 50, expiryDays: 100, sell: 2 }]);
        const appt = await makeAppointment(ALICE);
        await consult(appt, { status: 'ONGOING', prescription: [line(med)], labRequestIds: [1, 2] });
        const a: any = await query(`INSERT INTO patient_allergies (patient_id, allergy_name, severity) VALUES (?, 'Latex', 'MILD')`, [ALICE]);
        const body = await open(appt);
        expect(body.current.prescription).toHaveLength(1);
        expect(body.current.prescription[0]).toMatchObject({ medicineId: med, dosage: '1', frequency: '1-0-0-1', duration: '5 days', quantity: 10, dispensedQuantity: 0 });
        expect(body.current.labs.map((l: any) => l.testId)).toEqual([1, 2]);
        expect(body.patient.allergies.map((x: any) => x.name)).toContain('Latex');
        await query(`DELETE FROM patient_allergies WHERE id = ?`, [a.insertId]);
    });

    it('a fresh visit has nothing saved yet', async () => {
        const body = await open(await makeAppointment(BOB));
        expect(body.current).toEqual({ prescription: [], labs: [] });
    });
});

describe('the prescription list is the whole prescription', () => {
    it('adding one medicine to a reopened draft keeps the saved ones when the full list is sent', async () => {
        const a = await addMedicine(`KeepA-${Date.now()}`, [{ qty: 50, expiryDays: 100, sell: 2 }]);
        const b = await addMedicine(`KeepB-${Date.now()}`, [{ qty: 50, expiryDays: 100, sell: 2 }]);
        const appt = await makeAppointment(ALICE);
        await consult(appt, { status: 'ONGOING', prescription: [line(a)] });
        expect((await consult(appt, { status: 'ONGOING', prescription: [line(a), line(b)] })).status).toBe(200);
        expect((await items(appt)).map((r: any) => r.medicineId)).toEqual([a, b]);
    });

    it('leaving the prescription out leaves the saved one alone', async () => {
        const med = await addMedicine(`Omit-${Date.now()}`, [{ qty: 50, expiryDays: 100, sell: 2 }]);
        const appt = await makeAppointment(ALICE);
        await consult(appt, { status: 'ONGOING', prescription: [line(med)], labRequestIds: [1] });
        expect((await consult(appt, { status: 'ONGOING', notes: 'only notes changed' })).status).toBe(200);
        expect(await items(appt)).toHaveLength(1);
        expect(await labs(appt)).toHaveLength(1);
    });

    it('an empty list removes lines that have not been dispensed', async () => {
        const med = await addMedicine(`Empty-${Date.now()}`, [{ qty: 50, expiryDays: 100, sell: 2 }]);
        const appt = await makeAppointment(ALICE);
        await consult(appt, { status: 'ONGOING', prescription: [line(med)] });
        expect((await consult(appt, { status: 'ONGOING', prescription: [] })).status).toBe(200);
        expect(await items(appt)).toHaveLength(0);
    });

    it('a line already dispensed cannot be removed', async () => {
        const med = await addMedicine(`Locked-${Date.now()}`, [{ qty: 50, expiryDays: 100, sell: 2 }]);
        const appt = await makeAppointment(ALICE);
        await consult(appt, { status: 'ONGOING', prescription: [line(med, { quantity: 4 })] });
        const p = await one(`SELECT id FROM prescriptions WHERE appointment_id = ?`, [appt]);
        const item = await one(`SELECT id FROM prescription_items WHERE prescription_id = ?`, [p.id]);
        await dispense(p.id, { action: 'DISPENSE', quantity_to_dispense: 4, item_id: item.id });
        expect((await consult(appt, { status: 'ONGOING', prescription: [] })).status).toBe(409);
        expect(await items(appt)).toHaveLength(1);
        const body = await open(appt);
        expect(body.current.prescription[0].dispensedQuantity).toBe(4);
    });
});

describe('lab requests', () => {
    it('a test not yet done can be taken off; one with a result is kept', async () => {
        const appt = await makeAppointment(ALICE);
        await consult(appt, { status: 'ONGOING', labRequestIds: [1, 2, 3] });
        await query(`UPDATE lab_requests SET status = 'COMPLETED', completed_at = NOW() WHERE appointment_id = ? AND test_id = 1`, [appt]);
        expect((await consult(appt, { status: 'ONGOING', labRequestIds: [2] })).status).toBe(200);
        expect(await labs(appt)).toEqual([{ testId: 1, status: 'COMPLETED' }, { testId: 2, status: 'PENDING' }]);
    });

    it('an empty list clears the open requests; leaving it out changes nothing', async () => {
        const appt = await makeAppointment(ALICE);
        await consult(appt, { status: 'ONGOING', labRequestIds: [1, 2] });
        await consult(appt, { status: 'ONGOING' });
        expect(await labs(appt)).toHaveLength(2);
        await consult(appt, { status: 'ONGOING', labRequestIds: [] });
        expect(await labs(appt)).toHaveLength(0);
    });

    it('a bad list is rejected without touching the saved requests', async () => {
        const appt = await makeAppointment(ALICE);
        await consult(appt, { status: 'ONGOING', labRequestIds: [1] });
        expect((await consult(appt, { status: 'ONGOING', labRequestIds: 'x' })).status).toBe(400);
        expect(await labs(appt)).toHaveLength(1);
    });

    it('the bill counts only the tests that are still requested', async () => {
        const appt = await makeAppointment(ALICE);
        await consult(appt, { status: 'ONGOING', labRequestIds: [1, 2] });
        await consult(appt, { status: 'COMPLETED', labRequestIds: [1] });
        const bill = await one(`SELECT lab_total FROM bills WHERE appointment_id = ?`, [appt]);
        const price = await one(`SELECT price FROM lab_tests WHERE id = 1`);
        expect(Number(bill.lab_total)).toBe(Number(price.price));
    });
});

describe('allergy check', () => {
    const allergic = async (name: string) => {
        const r: any = await query(`INSERT INTO patient_allergies (patient_id, allergy_name, severity) VALUES (?, ?, 'SEVERE')`, [ALICE, name]);
        return r.insertId as number;
    };

    it('stops a medicine the patient is allergic to, and says which allergy and which medicine', async () => {
        const tag = `Zorbacillin${Date.now()}`;
        const id = await allergic(tag);
        const med = await addMedicine(`${tag} 500mg`, [{ qty: 50, expiryDays: 100, sell: 2 }]);
        const appt = await makeAppointment(ALICE);
        const res = await consult(appt, { status: 'ONGOING', prescription: [line(med)] });
        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.code).toBe('ALLERGY');
        expect(body.medicineId).toBe(med);
        expect(body.message).toContain(tag);
        expect(await items(appt)).toHaveLength(0);                      // nothing was saved
        await query(`DELETE FROM patient_allergies WHERE id = ?`, [id]);
    });

    it('lets it through once the doctor confirms, and records the override in the audit trail', async () => {
        const tag = `Quellomycin${Date.now()}`;
        const id = await allergic(tag);
        const med = await addMedicine(`${tag} 250mg`, [{ qty: 50, expiryDays: 100, sell: 2 }]);
        const appt = await makeAppointment(ALICE);
        expect((await consult(appt, { status: 'ONGOING', prescription: [line(med)], allergyAcknowledged: [med] })).status).toBe(200);
        expect(await items(appt)).toHaveLength(1);
        const entry = await one(`SELECT details FROM audit_log WHERE entity_type = 'CONSULTATION' AND entity_id = ? ORDER BY id DESC LIMIT 1`, [String(appt)]);
        expect(String(entry.details)).toContain('allergyOverrides');
        expect(String(entry.details)).toContain(tag);
        // Saving again does not ask a second time for a line that is already on the prescription
        expect((await consult(appt, { status: 'ONGOING', prescription: [line(med)] })).status).toBe(200);
        await query(`DELETE FROM patient_allergies WHERE id = ?`, [id]);
    });

    it('confirming one medicine does not confirm another', async () => {
        const tag = `Brunexil${Date.now()}`;
        const id = await allergic(tag);
        const bad = await addMedicine(`${tag} 100mg`, [{ qty: 50, expiryDays: 100, sell: 2 }]);
        const other = await addMedicine(`${tag} Forte`, [{ qty: 50, expiryDays: 100, sell: 2 }]);
        const appt = await makeAppointment(ALICE);
        expect((await consult(appt, { status: 'ONGOING', prescription: [line(bad), line(other)], allergyAcknowledged: [bad] })).status).toBe(409);
        await query(`DELETE FROM patient_allergies WHERE id = ?`, [id]);
    });

    it('an unrelated medicine and a patient with no allergies are not blocked', async () => {
        const med = await addMedicine(`Plain-${Date.now()}`, [{ qty: 50, expiryDays: 100, sell: 2 }]);
        const appt = await makeAppointment(BOB);
        expect((await consult(appt, { status: 'ONGOING', prescription: [line(med)] })).status).toBe(200);
        const id = await allergic(`Unrelatedium${Date.now()}`);
        expect((await consult(await makeAppointment(ALICE), { status: 'ONGOING', prescription: [line(med)] })).status).toBe(200);
        await query(`DELETE FROM patient_allergies WHERE id = ?`, [id]);
    });

    it('a bad acknowledgement list is a 400', async () => {
        const appt = await makeAppointment(ALICE);
        expect((await consult(appt, { status: 'ONGOING', allergyAcknowledged: 'x' })).status).toBe(400);
    });
});

describe('medicine catalogue for the doctor', () => {
    it('reports usable stock without expired batches, plus generic name and strength', async () => {
        const name = `Usable-${Date.now()}`;
        const med = await addMedicine(name, [{ qty: 30, expiryDays: 100, sell: 2 }, { qty: 20, expiryDays: -5, sell: 2 }]);
        await query(`UPDATE medicines SET generic_name = 'testgeneric', strength = '500mg' WHERE id = ?`, [med]);
        await as('DOCTOR', DOCTOR);
        const { GET } = await import('@/app/api/admin/medicines/route');
        const found = (await (await GET()).json()).find((m: any) => m.id === med);
        expect(found.stock).toBe(50);
        expect(Number(found.usable_stock)).toBe(30);
        expect(found).toMatchObject({ generic_name: 'testgeneric', strength: '500mg' });
    });
});
