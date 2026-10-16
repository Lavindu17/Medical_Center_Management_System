
import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';
import { hasLabExtras } from '@/lib/schema-features';

// GET Pending Lab Requests
export async function GET(req: Request) {
    try {
        const auth = await requirePermission('lab.requests', 'view');
        if ('error' in auth) return auth.error;
        const user = auth.user;

        // Urgent requests first (priority and the doctor's note come from 21_orders.sql once it has been applied)
        const extras = await hasLabExtras();
        const requests = await query(`
            SELECT 
                lr.id as request_id,
                lr.status,
                lr.requested_at,
                lr.result_url,
                lr.completed_at,
                lr.appointment_id,
                ${extras ? 'lr.priority, lr.clinical_note' : "'ROUTINE' AS priority, NULL AS clinical_note"},
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
            ORDER BY ${extras ? "(lr.status = 'PENDING' AND lr.priority = 'URGENT') DESC, " : ''}lr.requested_at DESC
        `);

        return NextResponse.json(requests);
    } catch (error) {
        console.error('Fetch Lab Requests Error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
