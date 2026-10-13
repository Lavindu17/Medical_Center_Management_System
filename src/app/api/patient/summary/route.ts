import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireRole } from '@/lib/api-auth';

/** What needs the patient's attention: medicines still to collect, lab results ready, bills to pay. Their own records only. */
export async function GET() {
    const auth = await requireRole('PATIENT');
    if ('error' in auth) return auth.error;
    const { user } = auth;

    try {
        const [rx, labs, bills] = await Promise.all([
            query<any[]>(
                `SELECT COUNT(*) AS n FROM prescriptions pr JOIN appointments a ON a.id = pr.appointment_id
                 WHERE a.patient_id = ? AND pr.status IN ('PENDING', 'PARTIALLY_COMPLETED')`, [user.id]),
            query<any[]>(
                `SELECT COUNT(*) AS n FROM lab_requests lr JOIN appointments a ON a.id = lr.appointment_id
                 WHERE a.patient_id = ? AND lr.status = 'COMPLETED' AND lr.completed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`, [user.id]),
            query<any[]>(
                `SELECT COUNT(*) AS n, COALESCE(SUM(b.total_amount), 0) AS amount FROM bills b JOIN appointments a ON a.id = b.appointment_id
                 WHERE a.patient_id = ? AND b.status = 'PENDING' AND a.status <> 'CANCELLED'`, [user.id]),
        ]);
        return NextResponse.json({
            prescriptionsToCollect: Number(rx[0].n),
            labResultsReady: Number(labs[0].n),
            unpaidBills: Number(bills[0].n),
            unpaidAmount: Number(bills[0].amount),
        });
    } catch (error) {
        console.error('Patient summary error:', error);
        return NextResponse.json({ message: 'Could not load your summary' }, { status: 500 });
    }
}
