import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { appointmentId, vitals, notes, prescription, labRequestIds, status } = body;

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // 1. Update Appointment (Vitals + Notes + Status)
            await connection.execute(
                `UPDATE appointments 
                 SET weight = ?, blood_pressure = ?, temperature = ?, pulse = ?, notes = ?, status = ? 
                 WHERE id = ?`,
                [
                    vitals.weight || null,
                    vitals.blood_pressure || null,
                    vitals.temperature || null,
                    vitals.pulse || null,
                    notes,
                    status,
                    appointmentId
                ]
            );

            // 2. Handle Prescriptions
            // First, delete existing (if updating draft)? Or just insert new?
            // To simplify "Draft" logic, we might wipe and recreate or just append. 
            // For now, let's assume one prescription per appointment for simplicity.
            // Check if prescription exists
            const [existingPres]: any = await connection.execute('SELECT id FROM prescriptions WHERE appointment_id = ?', [appointmentId]);
            let prescriptionId = existingPres[0]?.id;

            if (prescription && prescription.length > 0) {
                // Get Doctor ID from appointment
                const [apptRows]: any = await connection.execute('SELECT doctor_id FROM appointments WHERE id = ?', [appointmentId]);
                const doctorId = apptRows[0].doctor_id;

                if (!prescriptionId) {
                    const [res]: any = await connection.execute(
                        'INSERT INTO prescriptions (appointment_id, doctor_id, status) VALUES (?, ?, "PENDING")',
                        [appointmentId, doctorId]
                    );
                    prescriptionId = res.insertId;
                }

                // Determine Items to Insert
                // Strategy: Delete all items and re-insert (Simplest for updates)
                await connection.execute('DELETE FROM prescription_items WHERE prescription_id = ?', [prescriptionId]);

                for (const item of prescription) {
                    await connection.execute(
                        `INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, duration, quantity) 
                          VALUES (?, ?, ?, ?, ?, ?)`,
                        [prescriptionId, item.medicineId, item.dosage, item.frequency, item.duration, item.quantity]
                    );
                }
            }

            // 3. Handle Lab Requests
            // Similar strategy: Delete all for this appointment and re-insert?
            // Or only insert new. Simplest: Delete all PENDING requests and re-insert. 
            // Warning: If results uploaded, don't delete! 
            // Safe approach: checking if exists. 
            // For MVP: assume adding new requests.
            if (labRequestIds && labRequestIds.length > 0) {
                for (const testId of labRequestIds) {
                    // Check if already requested
                    const [exists]: any = await connection.execute(
                        'SELECT id FROM lab_requests WHERE appointment_id = ? AND test_id = ?',
                        [appointmentId, testId]
                    );
                    if (exists.length === 0) {
                        await connection.execute(
                            'INSERT INTO lab_requests (appointment_id, test_id) VALUES (?, ?)',
                            [appointmentId, testId]
                        );
                    }
                }
            }

            // 4. Generate Bill Stub (If Completed)
            if (status === 'COMPLETED') {
                // Check if bill exists
                const [billExists]: any = await connection.execute('SELECT id FROM bills WHERE appointment_id = ?', [appointmentId]);

                if (billExists.length === 0) {
                    // Get Doctor Fee
                    const [appt]: any = await connection.execute('SELECT doctor_id FROM appointments WHERE id = ?', [appointmentId]);
                    const [doc]: any = await connection.execute('SELECT consultation_fee FROM doctors WHERE user_id = ?', [appt[0].doctor_id]);
                    const fee = doc[0]?.consultation_fee || 0;

                    // Service Charge (Standard 500?)
                    const serviceCharge = 500.00;

                    // Lab Total
                    // Calculate from Lab Requests?
                    // We need prices.
                    let labTotal = 0;
                    if (labRequestIds && labRequestIds.length > 0) {
                        // This is tricky inside loop or need join. 
                        // Let's do a quick sum query if possible or iterate.
                        // optimize: next iteration.
                    }

                    // Pharmacy Total (Calculated by Pharmacist later? Or estimated now?)
                    // "Billing Trigger: Any edit made by Pharmacist...". So Pharmacy Total is updated LATER.
                    // For now, init bill with Doc Fee + Service Charge.

                    await connection.execute(
                        `INSERT INTO bills (appointment_id, doctor_fee, service_charge, pharmacy_total, lab_total, total_amount, status)
                         VALUES (?, ?, ?, 0, 0, ?, 'PENDING')`,
                        [appointmentId, fee, serviceCharge, (Number(fee) + Number(serviceCharge))]
                    );
                }
            }

            await connection.commit();
            return NextResponse.json({ message: 'Saved successfully' });

        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Save Consultation Error:', error);
        return NextResponse.json({ message: 'Failed to save' }, { status: 500 });
    }
}
