
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { AuthService } from '@/services/auth.service';
import { cookies } from 'next/headers';

async function getPharmacist() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;
    const user = await AuthService.verifyToken(token);
    // @ts-ignore
    if (!user || user.role !== 'PHARMACIST') return null;
    return user;
}

export async function GET() {
    try {
        const user = await getPharmacist();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rows = await query(
            `SELECT 
                p.id, 
                p.status, 
                p.issued_at as created_at,
                pat_user.name as patient_name, 
                pat_user.id as patient_id,
                doc_user.name as doctor_name,
                (SELECT COUNT(*) FROM prescription_items pi WHERE pi.prescription_id = p.id) as item_count
            FROM prescriptions p
            JOIN appointments a ON p.appointment_id = a.id
            JOIN users pat_user ON a.patient_id = pat_user.id
            JOIN users doc_user ON p.doctor_id = doc_user.id
            WHERE p.status = 'PENDING'
            ORDER BY p.issued_at ASC`
        );

        return NextResponse.json(rows);
    } catch (error) {
        console.error('Error fetching prescriptions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch prescriptions' },
            { status: 500 }
        );
    }
}
