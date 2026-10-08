
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

// GET Pending Lab Requests
export async function GET(req: Request) {
    try {
        const auth = await requireRole('LAB_ASSISTANT');
        if ('error' in auth) return auth.error;
        const user = auth.user;

        // Fetch pending requests with details
        const requests = await query(`
            SELECT 
                lr.id as request_id,
                lr.status,
                lr.requested_at,
                lr.result_url,
                lr.completed_at,
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
            WHERE a.status <> 'CANCELLED'
            ORDER BY lr.requested_at DESC
        `);

        return NextResponse.json(requests);
    } catch (error) {
        console.error('Fetch Lab Requests Error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
