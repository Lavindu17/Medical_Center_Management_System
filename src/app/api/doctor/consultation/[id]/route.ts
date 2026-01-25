import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const id = (await params).id;

        // 1. Get Appointment & Patient Details
        // We join 'patients' table to get medical_history etc.
        const [rows]: any = await query(
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

        // 2. Fetch History (Previous Appointments)
        const historyRows = await query<any[]>(
            `SELECT date, notes as diagnosis 
             FROM appointments 
             WHERE patient_id = ? AND id != ? AND status = 'COMPLETED' 
             ORDER BY date DESC LIMIT 5`,
            [appt.patient_id, id]
        );

        return NextResponse.json({
            appointment: appointmentData,
            patient: patientData,
            history: historyRows
        });

    } catch (error) {
        console.error('Consultation Detail Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
