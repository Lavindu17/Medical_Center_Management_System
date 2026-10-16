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

/** Sets the stored ticks of one screen on a role's profile (the way the access window does), so a test can take a permission away. */
export async function setRoleTicks(role: string, resource: string, levels: string[]) {
    await query(
        `UPDATE access_grants g JOIN access_profiles p ON p.id = g.profile_id
         SET g.can_view = ?, g.can_add = ?, g.can_change = ?, g.can_approve = ? WHERE p.system_role = ? AND g.resource = ?`,
        [+levels.includes('view'), +levels.includes('add'), +levels.includes('change'), +levels.includes('approve'), role, resource]);
}
/** Writes a role's starting profile back (what the "Reset to defaults" button does). */
export async function restoreRole(role: string) {
    const { pool } = await import('@/lib/db');
    const { resetRole } = await import('@/lib/access/admin');
    const connection = await pool.getConnection();
    try { await connection.beginTransaction(); await resetRole(connection, role as any); await connection.commit(); }
    catch (err) { await connection.rollback(); throw err; }
    finally { connection.release(); }
}

export const rx = (medicineId: number, quantity: number) =>
    [{ medicineId, dosage: '1', frequency: '1-0-0-0', duration: '5 days', quantity }];


/** Runs a whole SQL file (several statements). The app's own connection refuses that on purpose, so this opens its own. */
export async function runSqlFile(sql: string, times = 1) {
    const mysql = (await import('mysql2/promise')).default;
    const conn = await mysql.createConnection({
        host: process.env.MYSQL_HOST, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE, port: Number(process.env.MYSQL_PORT) || 3306, multipleStatements: true,
    });
    try { for (let i = 0; i < times; i++) await conn.query(sql); } finally { await conn.end(); }
}
