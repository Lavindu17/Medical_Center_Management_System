import { state } from '../helpers/state';
import { tokenFor, Role } from '../helpers/auth';
import { query } from '@/lib/db';

export const DOCTOR = 2, ALICE = 4, BOB = 5, PHARMACIST = 6, RECEPTIONIST = 8;
export const FBC_LAB_TEST = 1; // 850.00

export const as = async (role: Role, id: number) => { state.token = await tokenFor(role, id); };
export const post = (url: string, body: unknown, method = 'POST') =>
    new Request('http://localhost' + url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
export const ctx = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });

export function isoDate(offsetDays: number) {
    const d = new Date(); d.setDate(d.getDate() + offsetDays);
    return d.toLocaleDateString('en-CA');
}
export const daysFromNow = isoDate;

export async function rows<T = any>(sql: string, params: any[] = []) { return query<T[]>(sql, params); }
export async function one<T = any>(sql: string, params: any[] = []) { return (await rows<T>(sql, params))[0]; }

let slotCounter = 0;
export async function makeAppointment(patient = ALICE, status = 'PENDING') {
    const slot = `${String(9 + Math.floor(slotCounter / 4)).padStart(2, '0')}:${String((slotCounter % 4) * 15).padStart(2, '0')}`;
    slotCounter++;
    const r: any = await query(
        `INSERT INTO appointments (patient_id, doctor_id, date, time_slot, queue_number, status) VALUES (?, ?, ?, ?, ?, ?)`,
        [patient, DOCTOR, isoDate(2), slot, slotCounter, status]);
    return r.insertId as number;
}

export async function addMedicine(name: string, batches: { qty: number; expiryDays: number; sell: number }[]) {
    const m: any = await query(
        `INSERT INTO medicines (name, stock, unit, price_per_unit, min_stock_level) VALUES (?, ?, 'tablets', 5, 10)`,
        [name, batches.reduce((s, b) => s + b.qty, 0)]);
    for (const [i, b] of batches.entries()) {
        await query(
            `INSERT INTO inventory_batches (medicine_id, batch_number, expiry_date, quantity_initial, quantity_current, buying_price, selling_price, status)
             VALUES (?, ?, ?, ?, ?, 3, ?, 'ACTIVE')`,
            [m.insertId, `${name}-B${i + 1}`, daysFromNow(b.expiryDays), b.qty, b.qty, b.sell]);
    }
    return m.insertId as number;
}

export async function consult(appointmentId: number, body: Record<string, unknown>) {
    await as('DOCTOR', DOCTOR);
    const { POST } = await import('@/app/api/doctor/consultation/save/route');
    return POST(post('/api/doctor/consultation/save', { appointmentId, vitals: {}, notes: 'n', ...body }));
}

export async function dispense(prescriptionId: number, body: Record<string, unknown>) {
    await as('PHARMACIST', PHARMACIST);
    const { POST } = await import('@/app/api/pharmacist/dispense/[id]/route');
    return POST(post(`/api/pharmacist/dispense/${prescriptionId}`, body), ctx(prescriptionId));
}

export const rx = (medicineId: number, quantity: number) =>
    [{ medicineId, dosage: '1', frequency: '1-0-0-0', duration: '5 days', quantity }];

