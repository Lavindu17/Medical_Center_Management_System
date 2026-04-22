import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const patientId = searchParams.get('patientId');
        const type = searchParams.get('type'); // 'prescriptions' | 'labs' | 'bills'

        if (!patientId) return NextResponse.json({ message: 'Patient ID required' }, { status: 400 });

        let data;

        if (type === 'prescriptions') {
            data = await query(`
        SELECT 
          p.id, p.status, p.issued_at,
          d.name as doctorName,
          doc.specialization,
          pi.dosage, pi.frequency, pi.duration, pi.quantity,
          m.name as medicineName
        FROM prescriptions p
        JOIN appointments a ON p.appointment_id = a.id
        JOIN users d ON p.doctor_id = d.id
        JOIN doctors doc ON d.id = doc.user_id
        JOIN prescription_items pi ON p.id = pi.prescription_id
        JOIN medicines m ON pi.medicine_id = m.id
        WHERE a.patient_id = ?
        ORDER BY p.issued_at DESC
      `, [patientId]);

            // Group items by prescription if needed, but flat list is okay for basic view or we organize on frontend

        } else if (type === 'labs') {
            data = await query(`
        SELECT 
          lr.id, lr.status, lr.requested_at, lr.result_url,
          lt.name as testName, lt.description,
          d.name as doctorName
        FROM lab_requests lr
        JOIN appointments a ON lr.appointment_id = a.id
        JOIN lab_tests lt ON lr.test_id = lt.id
        JOIN users d ON a.doctor_id = d.id
        WHERE a.patient_id = ?
        ORDER BY lr.requested_at DESC
      `, [patientId]);

        } else if (type === 'bills') {
            const bills: any = await query(`
                SELECT 
                  b.id, b.total_amount, b.status, b.generated_at, b.paid_at,
                  b.doctor_fee, b.pharmacy_total, b.lab_total, b.service_charge,
                  a.id as appointment_id, a.date as appointmentDate,
                  d.name as doctorName, doc.specialization
                FROM bills b
                JOIN appointments a ON b.appointment_id = a.id
                JOIN users d ON a.doctor_id = d.id
                JOIN doctors doc ON doc.user_id = d.id
                WHERE a.patient_id = ?
                ORDER BY b.generated_at DESC
            `, [patientId]);

            // Enrich each bill with line items
            for (const bill of bills as any[]) {
                // Lab line items
                const labItems: any = await query(`
                    SELECT lt.name, lt.price
                    FROM lab_requests lr
                    JOIN lab_tests lt ON lt.id = lr.test_id
                    WHERE lr.appointment_id = ?
                `, [bill.appointment_id]);
                bill.lab_items = labItems;

                // Medicine line items (dispensed only)
                const medicineItems: any = await query(`
                    SELECT m.name, m.unit, pi.dispensed_quantity as qty, m.price_per_unit as unit_price,
                           (pi.dispensed_quantity * m.price_per_unit) as total
                    FROM prescription_items pi
                    JOIN prescriptions pr ON pr.id = pi.prescription_id
                    JOIN medicines m ON m.id = pi.medicine_id
                    WHERE pr.appointment_id = ?
                      AND pi.dispensed_quantity > 0
                `, [bill.appointment_id]);
                bill.medicine_items = medicineItems;
            }

            data = bills;

        } else {
            return NextResponse.json({ message: 'Invalid type' }, { status: 400 });
        }

        return NextResponse.json(data);

    } catch (error) {
        console.error('Records API Error:', error);
        return NextResponse.json({ message: 'Failed to fetch records' }, { status: 500 });
    }
}
