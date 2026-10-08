import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { z } from 'zod';
import { requireRole } from '@/lib/api-auth';
import { parseBody } from '@/lib/validate';
import { itemStatus, prescriptionStatus } from '@/lib/prescription';
import { nameOf, notify, usersWithRole } from '@/lib/notify';

const SERVICE_CHARGE = 500.0;
const CLOSED_STATUSES = ['CANCELLED', 'ABSENT', 'NO_SHOW'];

/** Business-rule failure that maps to a specific HTTP status instead of a generic 500. */
class HttpError extends Error {
    constructor(public status: number, message: string) { super(message); }
}

const blank = (v: unknown) => v === undefined || v === null || v === '';

/** A vital may be left blank, but anything entered must be a number (0 is a legitimate value). */
const vital = (label: string) => z.unknown().transform((value, ctx) => {
    if (blank(value)) return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
        ctx.addIssue({ code: 'custom', message: `${label} must be a non-negative number` });
        return z.NEVER;
    }
    return n;
});

const positiveInt = (message: string) => z.number({ message }).int(message).positive(message);
const requiredText = (key: string) => z.string({ message: `${key} is required` }).trim().min(1, `${key} is required`);

const consultationSchema = z.object({
    appointmentId: z.number({ message: 'appointmentId is required' }).int('appointmentId is required'),
    status: z.enum(['ONGOING', 'COMPLETED'], { message: 'status must be ONGOING or COMPLETED' }),
    notes: z.unknown().transform((v) => (typeof v === 'string' ? v : null)),
    vitals: z.object({
        weight: vital('weight'),
        temperature: vital('temperature'),
        pulse: vital('pulse'),
        blood_pressure: z.unknown().transform((v) => (blank(v) ? null : String(v))),
    }).nullish().transform((v) => v ?? { weight: null, temperature: null, pulse: null, blood_pressure: null }),
    prescription: z.array(z.object({
        medicineId: positiveInt('Each prescription line needs a medicine'),
        quantity: positiveInt('Prescription quantity must be a positive whole number'),
        dosage: requiredText('dosage'),
        frequency: requiredText('frequency'),
        duration: requiredText('duration'),
    }), { message: 'prescription must be an array' }).nullish().transform((v) => v ?? []),
    labRequestIds: z.array(positiveInt('labRequestIds must be an array of test ids'), { message: 'labRequestIds must be an array of test ids' })
        .nullish().transform((v) => [...new Set(v ?? [])]),
});

export async function POST(req: Request) {
    const auth = await requireRole('DOCTOR');
    if ('error' in auth) return auth.error;
    const { user } = auth;

    try {
        const body = await parseBody(req, consultationSchema);
        if ('error' in body) return body.error;
        const { appointmentId, status, notes, prescription: items, labRequestIds: labIds } = body.data;
        const { weight, temperature, pulse, blood_pressure: bloodPressure } = body.data.vitals;

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            let newPrescription = false, newItems = 0, newLabs = 0, billCreated = false;

            // Lock the appointment first: every save for it is serialised, which also keeps the
            // prescription / item / bill writes below free of lock-order deadlocks.
            const [apptRows]: any = await connection.execute(
                'SELECT id, doctor_id, patient_id, status FROM appointments WHERE id = ? FOR UPDATE', [appointmentId]);
            if (apptRows.length === 0) throw new HttpError(404, 'Appointment not found');
            const appt = apptRows[0];
            if (appt.doctor_id !== user.id) throw new HttpError(403, 'Forbidden');
            if (CLOSED_STATUSES.includes(appt.status)) {
                throw new HttpError(409, `A ${appt.status.toLowerCase().replace('_', ' ')} appointment cannot be consulted`);
            }
            if (appt.status === 'COMPLETED' && status === 'ONGOING') {
                throw new HttpError(409, 'A completed consultation cannot be reopened');
            }

            // 1. Vitals + notes + status
            await connection.execute(
                `UPDATE appointments
                 SET weight = ?, blood_pressure = ?, temperature = ?, pulse = ?, notes = ?, status = ?
                 WHERE id = ?`,
                [weight, bloodPressure, temperature, pulse, notes, status, appointmentId]);

            // 2. Prescription: update lines in place so dispensing progress is never lost
            if (items.length > 0) {
                const [presRows]: any = await connection.execute('SELECT id FROM prescriptions WHERE appointment_id = ?', [appointmentId]);
                let prescriptionId: number = presRows[0]?.id;
                if (!prescriptionId) {
                    const [res]: any = await connection.execute(
                        'INSERT INTO prescriptions (appointment_id, doctor_id, status) VALUES (?, ?, "PENDING")',
                        [appointmentId, appt.doctor_id]);
                    prescriptionId = res.insertId;
                    newPrescription = true;
                }

                const [existing]: any = await connection.execute(
                    'SELECT id, medicine_id, quantity, status, dispensed_quantity FROM prescription_items WHERE prescription_id = ?',
                    [prescriptionId]);
                const unmatched = [...existing];

                for (const item of items) {
                    const idx = unmatched.findIndex((e: any) => e.medicine_id === item.medicineId);
                    if (idx === -1) {
                        await connection.execute(
                            `INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, duration, quantity)
                             VALUES (?, ?, ?, ?, ?, ?)`,
                            [prescriptionId, item.medicineId, item.dosage, item.frequency, item.duration, item.quantity]);
                        newItems++;
                        continue;
                    }
                    const [match] = unmatched.splice(idx, 1);
                    if (item.quantity < match.dispensed_quantity) {
                        throw new HttpError(409, `Quantity cannot be reduced below the ${match.dispensed_quantity} already dispensed`);
                    }
                    await connection.execute(
                        'UPDATE prescription_items SET dosage = ?, frequency = ?, duration = ?, quantity = ?, status = ? WHERE id = ?',
                        [item.dosage, item.frequency, item.duration, item.quantity,
                         itemStatus(match.status, item.quantity, match.dispensed_quantity), match.id]);
                }

                // Lines the doctor removed: only untouched ones may go
                for (const gone of unmatched) {
                    if (gone.dispensed_quantity > 0) {
                        throw new HttpError(409, 'A medicine that has already been dispensed cannot be removed from the prescription');
                    }
                    await connection.execute('DELETE FROM prescription_items WHERE id = ?', [gone.id]);
                }

                const [after]: any = await connection.execute('SELECT status FROM prescription_items WHERE prescription_id = ?', [prescriptionId]);
                await connection.execute('UPDATE prescriptions SET status = ? WHERE id = ?', [prescriptionStatus(after), prescriptionId]);
            }

            // 3. Lab requests (add-only; never touch ones already carrying a result)
            for (const testId of labIds) {
                const [exists]: any = await connection.execute(
                    'SELECT id FROM lab_requests WHERE appointment_id = ? AND test_id = ?', [appointmentId, testId]);
                if (exists.length === 0) {
                    await connection.execute('INSERT INTO lab_requests (appointment_id, test_id) VALUES (?, ?)', [appointmentId, testId]);
                    newLabs++;
                }
            }

            // 4. Bill (on completion). The doctor fee is snapshotted when the bill is created, and a bill that is
            //    already PAID is a closed record that is never rewritten.
            if (status === 'COMPLETED') {
                const [bills]: any = await connection.execute(
                    'SELECT id, status, doctor_fee, service_charge FROM bills WHERE appointment_id = ? FOR UPDATE', [appointmentId]);

                if (bills.length === 0 || bills[0].status !== 'PAID') {
                    const [[lab]]: any = await connection.execute(
                        `SELECT COALESCE(SUM(lt.price), 0) AS total FROM lab_requests lr
                         JOIN lab_tests lt ON lt.id = lr.test_id WHERE lr.appointment_id = ?`, [appointmentId]);
                    const [[pharmacy]]: any = await connection.execute(
                        `SELECT COALESCE(SUM(pi.dispensed_amount), 0) AS total FROM prescription_items pi
                         JOIN prescriptions p ON p.id = pi.prescription_id WHERE p.appointment_id = ?`, [appointmentId]);
                    const labTotal = Number(lab.total);
                    const pharmacyTotal = Number(pharmacy.total);

                    if (bills.length === 0) {
                        const [[doc]]: any = await connection.execute('SELECT consultation_fee FROM doctors WHERE user_id = ?', [appt.doctor_id]);
                        const fee = Number(doc?.consultation_fee || 0);
                        await connection.execute(
                            `INSERT INTO bills (appointment_id, doctor_fee, service_charge, pharmacy_total, lab_total, total_amount, status)
                             VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
                            [appointmentId, fee, SERVICE_CHARGE, pharmacyTotal, labTotal, fee + SERVICE_CHARGE + labTotal + pharmacyTotal]);
                        billCreated = true;
                    } else {
                        const total = Number(bills[0].doctor_fee) + Number(bills[0].service_charge) + labTotal + pharmacyTotal;
                        await connection.execute(
                            'UPDATE bills SET lab_total = ?, pharmacy_total = ?, total_amount = ? WHERE id = ?',
                            [labTotal, pharmacyTotal, total, bills[0].id]);
                    }
                }
            }

            // In-app notifications (written in this transaction, so a rollback sends none)
            const patientName = (newPrescription || newItems > 0 || newLabs > 0 || billCreated) ? await nameOf(connection, appt.patient_id) : '';
            if (newPrescription || newItems > 0) {
                await notify(connection, await usersWithRole(connection, 'PHARMACIST'), {
                    type: 'PRESCRIPTION_ISSUED', title: 'New prescription',
                    body: `A prescription for ${patientName} is ready to dispense.`, link: '/pharmacist/prescriptions',
                });
            }
            if (newPrescription) {
                await notify(connection, appt.patient_id, {
                    type: 'PRESCRIPTION_ISSUED', title: 'Prescription issued',
                    body: 'Your doctor issued a prescription. The pharmacy will prepare it.', link: '/patient/prescriptions',
                });
            }
            if (newLabs > 0) {
                await notify(connection, await usersWithRole(connection, 'LAB_ASSISTANT'), {
                    type: 'LAB_REQUESTED', title: 'New lab request',
                    body: `${newLabs} lab test${newLabs === 1 ? '' : 's'} requested for ${patientName}.`, link: '/lab-assistant',
                });
                await notify(connection, appt.patient_id, {
                    type: 'LAB_REQUESTED', title: 'Lab tests requested',
                    body: `Your doctor requested ${newLabs} lab test${newLabs === 1 ? '' : 's'}. Please visit the lab.`, link: '/patient/labs',
                });
            }
            if (status === 'COMPLETED' && appt.status !== 'COMPLETED') {
                await notify(connection, appt.patient_id, {
                    type: 'CONSULTATION_COMPLETED', title: 'Consultation complete',
                    body: 'Your consultation is complete. Your bill is ready to view.', link: '/patient/billing',
                });
            }
            if (billCreated) {
                await notify(connection, await usersWithRole(connection, 'RECEPTIONIST'), {
                    type: 'BILL_READY', title: 'Bill ready',
                    body: `A bill was generated for ${patientName}.`, link: '/receptionist/billing',
                });
            }

            await connection.commit();
            return NextResponse.json({ message: 'Saved successfully' });
        } catch (err: any) {
            await connection.rollback().catch(() => {});
            if (err instanceof HttpError) return NextResponse.json({ message: err.message }, { status: err.status });
            if (err?.errno === 1452) {
                return NextResponse.json({ message: 'Unknown medicine or lab test in the request' }, { status: 400 });
            }
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Save Consultation Error:', error);
        return NextResponse.json({ message: 'Failed to save' }, { status: 500 });
    }
}
