import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const appointmentId = Number(id);

        if (isNaN(appointmentId)) {
            return NextResponse.json({ message: 'Invalid appointment ID' }, { status: 400 });
        }

        // 1. Appointment Info (with doctor details)
        const appointments = await query<any[]>(`
            SELECT 
                a.*,
                DATE_FORMAT(a.date, '%Y-%m-%d') as formatted_date,
                d_user.name as doctorName,
                d.specialization,
                p_user.name as patientName
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.user_id
            JOIN users d_user ON d.user_id = d_user.id
            LEFT JOIN users p_user ON a.patient_id = p_user.id
            WHERE a.id = ?
        `, [appointmentId]);

        if (appointments.length === 0) {
            return NextResponse.json({ message: 'Appointment not found' }, { status: 404 });
        }
        
        const appointment = appointments[0];

        // 2. Billing Info
        const bills = await query<any[]>(`
            SELECT *
            FROM bills
            WHERE appointment_id = ?
        `, [appointmentId]);
        
        const bill = bills.length > 0 ? bills[0] : null;

        // 3. Prescription Info
        const prescriptions = await query<any[]>(`
            SELECT p.id as prescriptionId, p.status as prescriptionStatus, p.issued_at
            FROM prescriptions p
            WHERE p.appointment_id = ?
        `, [appointmentId]);

        let prescriptionDetails = null;
        if (prescriptions.length > 0) {
            const prescriptionId = prescriptions[0].prescriptionId;
            const items = await query<any[]>(`
                SELECT pi.id, pi.status, pi.dosage, pi.frequency, pi.duration, pi.quantity, m.name as medicineName
                FROM prescription_items pi
                JOIN medicines m ON pi.medicine_id = m.id
                WHERE pi.prescription_id = ?
            `, [prescriptionId]);
            
            prescriptionDetails = {
                ...prescriptions[0],
                items
            };
        }

        // 4. Lab Results Info
        const labRequests = await query<any[]>(`
            SELECT lr.id, lr.status, lr.result_url, lr.requested_at, lr.completed_at, lt.name as testName, lt.description
            FROM lab_requests lr
            JOIN lab_tests lt ON lr.test_id = lt.id
            WHERE lr.appointment_id = ?
        `, [appointmentId]);

        return NextResponse.json({
            appointment,
            bill,
            prescription: prescriptionDetails,
            labs: labRequests
        });

    } catch (error) {
        console.error('Fetch Appointment Detail Error:', error);
        return NextResponse.json({ message: 'Failed to fetch appointment details' }, { status: 500 });
    }
}
