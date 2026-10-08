import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireRole } from '@/lib/api-auth';

export async function GET() {
    const auth = await requireRole('DOCTOR');
    if ('error' in auth) return auth.error;
    const { user } = auth;

    try {
        // Local calendar day (YYYY-MM-DD)
        const today = new Date().toLocaleDateString('en-CA');

        const [todayRows, upcomingRows, seenRows, revenueRows] = await Promise.all([
            query<any[]>(
                'SELECT COUNT(*) AS count FROM appointments WHERE doctor_id = ? AND date = ? AND status != "CANCELLED"',
                [user.id, today]),
            query<any[]>(
                'SELECT COUNT(*) AS count FROM appointments WHERE doctor_id = ? AND date > ? AND status != "CANCELLED"',
                [user.id, today]),
            // "Unique patients seen": people whose consultation was actually completed
            query<any[]>(
                'SELECT COUNT(DISTINCT patient_id) AS count FROM appointments WHERE doctor_id = ? AND status = "COMPLETED"',
                [user.id]),
            // Revenue is what has actually been paid: the doctor's fee on paid bills of completed visits.
            // (The Earnings page shows the same gross figure, plus the commission breakdown.)
            query<any[]>(
                `SELECT COALESCE(SUM(b.doctor_fee), 0) AS total
                 FROM appointments a JOIN bills b ON b.appointment_id = a.id
                 WHERE a.doctor_id = ? AND a.status = "COMPLETED" AND b.status = "PAID"`,
                [user.id]),
        ]);

        return NextResponse.json({
            todayAppointments: Number(todayRows[0].count),
            upcomingAppointments: Number(upcomingRows[0].count),
            totalPatients: Number(seenRows[0].count),
            revenue: Number(revenueRows[0].total),
        });

    } catch (error) {
        console.error('Doctor Stats Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
