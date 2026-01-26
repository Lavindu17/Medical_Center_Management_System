
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

// GET Pending Lab Requests
export async function GET(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        const user = await AuthService.verifyToken(token || '');
        if (!user || user.role !== 'LAB_ASSISTANT') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        // Fetch pending requests with details
        const requests = await query(`
            SELECT 
                lr.id as request_id,
                lr.status,
                lr.requested_at,
                lt.name as test_name,
                lt.price,
                p.name as patient_name,
                d.name as doctor_name,
                a.date as appointment_date
            FROM lab_requests lr
            JOIN lab_tests lt ON lr.test_id = lt.id
            JOIN appointments a ON lr.appointment_id = a.id
            JOIN users p ON a.patient_id = p.id
            JOIN users d ON a.doctor_id = d.id
            WHERE lr.status = 'PENDING'
            ORDER BY lr.requested_at ASC
        `);

        return NextResponse.json(requests);
    } catch (error) {
        console.error('Fetch Lab Requests Error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
