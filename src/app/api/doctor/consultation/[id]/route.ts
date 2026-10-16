import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { auditAccess } from '@/lib/audit';
import { hasLabExtras, hasRxExtras } from '@/lib/schema-features';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requirePermission('consultations', 'view');
    if ('error' in auth) return auth.error;
    const { user } = auth;

    try {
        const id = (await params).id;

        // 1. Get Appointment & Patient Details
        // We join 'patients' table to get medical_history etc.
        const rows: any = await query(
            `SELECT 
                a.*,
                u.name as patientName,
                u.email as patientEmail,
                p.date_of_birth,
                p.gender,
                p.medical_history,
                p.address
            FROM appointments a
            JOIN users u ON a.patient_id = u.id
            JOIN patients p ON u.id = p.user_id
            WHERE a.id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json({ message: 'Appointment not found' }, { status: 404 });
        }

        const appt = rows[0];
        if (appt.doctor_id !== user.id) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        await auditAccess(user, { action: 'VIEW', entity: 'CONSULTATION', entityId: id, patientId: appt.patient_id });

        // Calc Age
        const dob = new Date(appt.date_of_birth);
        const ageDifMs = Date.now() - dob.getTime();
        const ageDate = new Date(ageDifMs);
        const age = Math.abs(ageDate.getUTCFullYear() - 1970);

        const appointmentData = {
            id: appt.id,
            date: appt.date,
            timeSlot: appt.time_slot,
            reason: appt.reason, // Wait, reason col exists? Yes, added in step 688
            notes: appt.notes,
            status: appt.status,
            // Vitals (if schema updated)
            weight: appt.weight,
            blood_pressure: appt.blood_pressure,
            temperature: appt.temperature,
            pulse: appt.pulse
        };

        const patientData = {
            id: appt.patient_id,
            name: appt.patientName,
            age: age,
            dob: appt.date_of_birth,
            gender: appt.gender,
            medicalHistory: appt.medical_history
        };

        // 2. Fetch Full Relational History
        const [rxExtras, labExtras] = await Promise.all([hasRxExtras(), hasLabExtras()]);
        const rxCols = rxExtras ? 'pi.instructions, pi.food_timing AS foodTiming, pi.as_needed AS asNeeded' : "NULL AS instructions, NULL AS foodTiming, 0 AS asNeeded";
        const labCols = labExtras ? 'lr.priority, lr.clinical_note AS note' : "'ROUTINE' AS priority, NULL AS note";
        const [pastAppointments, pastLabs, pastPrescriptions, currentItems, currentLabs, allergies] = await Promise.all([
            // A. All Completed Appointments
            query<any[]>(
                `SELECT id, date, notes as diagnosis, reason
                 FROM appointments 
                 WHERE patient_id = ? AND id != ? AND status = 'COMPLETED' 
                 ORDER BY date DESC`,
                [appt.patient_id, id]
            ),
            // B. All Requested Labs
            query<any[]>(
                `SELECT lr.id, lr.appointment_id, lr.test_id, lr.status, lr.result_url, lr.requested_at, lt.name as testName
                 FROM lab_requests lr
                 JOIN appointments a ON lr.appointment_id = a.id
                 JOIN lab_tests lt ON lr.test_id = lt.id
                 WHERE a.patient_id = ? AND a.id != ?
                 ORDER BY lr.requested_at DESC`,
                [appt.patient_id, id]
            ),
            // C. All Prescriptions
            query<any[]>(
                `SELECT p.id as prescription_id, p.appointment_id, p.issued_at,
                        pi.medicine_id AS medicineId, pi.dosage, pi.frequency, pi.duration, pi.quantity, ${rxCols},
                        m.name as medicineName
                 FROM prescriptions p
                 JOIN appointments a ON p.appointment_id = a.id
                 JOIN prescription_items pi ON p.id = pi.prescription_id
                 JOIN medicines m ON pi.medicine_id = m.id
                 WHERE a.patient_id = ? AND a.id != ?
                 ORDER BY p.issued_at DESC`,
                [appt.patient_id, id]
            ),
            // D. What is already saved for this visit, so reopening a draft shows it (and saving keeps it)
            query<any[]>(
                `SELECT pi.medicine_id AS medicineId, m.name AS medicineName, pi.dosage, pi.frequency, pi.duration, pi.quantity, ${rxCols},
                        pi.status, COALESCE(pi.dispensed_quantity, 0) AS dispensedQuantity
                 FROM prescriptions p JOIN prescription_items pi ON pi.prescription_id = p.id JOIN medicines m ON m.id = pi.medicine_id
                 WHERE p.appointment_id = ? ORDER BY pi.id`, [id]),
            query<any[]>(
                `SELECT lr.id, lr.test_id AS testId, lt.name, lr.status, lr.result_url AS resultUrl, ${labCols}
                 FROM lab_requests lr JOIN lab_tests lt ON lt.id = lr.test_id WHERE lr.appointment_id = ? ORDER BY lr.id`, [id]),
            // E. Allergies, shown for the whole visit and checked when a medicine is added
            query<any[]>('SELECT allergy_name AS name, severity FROM patient_allergies WHERE patient_id = ? ORDER BY allergy_name', [appt.patient_id]),
        ]);

        return NextResponse.json({
            appointment: appointmentData,
            patient: { ...patientData, allergies },
            features: { rxExtras, labExtras },
            current: {
                prescription: currentItems.map((r) => ({ ...r, quantity: Number(r.quantity), dispensedQuantity: Number(r.dispensedQuantity), asNeeded: Boolean(Number(r.asNeeded)) })),
                labs: currentLabs,
            },
            history: {
                appointments: pastAppointments,
                labs: pastLabs,
                prescriptions: pastPrescriptions
            }
        });

    } catch (error) {
        console.error('Consultation Detail Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
