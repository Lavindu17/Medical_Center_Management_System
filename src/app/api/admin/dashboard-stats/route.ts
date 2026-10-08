import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireRole } from '@/lib/api-auth';

export async function GET() {
    const auth = await requireRole('ADMIN');
    if ('error' in auth) return auth.error;

    try {
        const [revenue, patients, staff, today] = await Promise.all([
            query<any[]>(`SELECT COALESCE(SUM(total_amount), 0) AS total FROM bills WHERE status = 'PAID'`),
            query<any[]>(`SELECT COUNT(*) AS total FROM users WHERE role = 'PATIENT'`),
            query<any[]>(`SELECT COUNT(*) AS total FROM users WHERE role <> 'PATIENT'`),
            query<any[]>(`SELECT COUNT(*) AS total FROM appointments WHERE date = CURDATE() AND status <> 'CANCELLED'`),
        ]);

        return NextResponse.json({
            revenue: Number(revenue[0].total),
            patients: Number(patients[0].total),
            staff: Number(staff[0].total),
            todayAppointments: Number(today[0].total),
        });
    } catch (error) {
        console.error('Admin Dashboard Stats Error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
