import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const id = (await params).id;

        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        const user = await AuthService.verifyToken(token || '');
        if (!user || user.role !== 'DOCTOR') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        // 1. Fetch Patient
        const [patientRows]: any = await query(`
            SELECT u.id, u.name, u.phone, u.email, p.date_of_birth, p.gender, p.medical_history, p.address
            FROM users u
            JOIN patients p ON u.id = p.user_id
            WHERE u.id = ? AND u.role = 'PATIENT'
        `, [id]);

        if (patientRows.length === 0) return NextResponse.json({ message: 'Not found' }, { status: 404 });

        // 2. Fetch History (Completed appointments only)
        const historyRows = await query<any[]>(`
            SELECT id, date, time_slot, notes, status 
            FROM appointments 
            WHERE patient_id = ? AND status IN ('COMPLETED', 'ONGOING') 
            ORDER BY date DESC
        `, [id]);

        // 3. Enrich with Prescriptions (Iterative for simplicity, or we could JSON_ARRAYAGG if MySQL 8)
        // Let's do a simple enrichment loop
        const enrichedHistory = await Promise.all(historyRows.map(async (visit) => {
            // Get Prescription
            const [presRows]: any = await query('SELECT id FROM prescriptions WHERE appointment_id = ?', [visit.id]);
            let prescriptions: any[] = [];
            if (presRows.length > 0) {
                const pId = presRows[0].id;
                prescriptions = await query(`
                    SELECT pi.id, m.name as medicineName, pi.dosage, pi.frequency 
                    FROM prescription_items pi
                    JOIN medicines m ON pi.medicine_id = m.id
                    WHERE pi.prescription_id = ?
                 `, [pId]);
            }
            return { ...visit, prescriptions };
        }));

        return NextResponse.json({
            patient: patientRows[0],
            history: enrichedHistory
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
