import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

export async function GET(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        const user = await AuthService.verifyToken(token || '');
        if (!user || user.role !== 'DOCTOR') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const period = searchParams.get('period') || 'all'; // 'daily' | 'weekly' | 'monthly' | 'all'

        let dateFilter = '';
        if (period === 'daily') dateFilter = 'AND DATE(a.date) = CURDATE()';
        else if (period === 'weekly') dateFilter = 'AND a.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
        else if (period === 'monthly') dateFilter = 'AND a.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';

        // Doctor profile for commission rate
        const doctorRows: any = await query(
            'SELECT d.commission_rate, d.consultation_fee, u.name FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.user_id = ?',
            [user.id]
        );
        if (!doctorRows || doctorRows.length === 0) {
            return NextResponse.json({ message: 'Doctor profile not found' }, { status: 404 });
        }
        const commissionRate = Number(doctorRows[0].commission_rate || 0);

        const summaryRows: any = await query(`
            SELECT
                COUNT(a.id) as total_appointments,
                COALESCE(SUM(b.doctor_fee), 0) as gross_earned,
                COALESCE(SUM(b.doctor_fee * ? / 100), 0) as center_commission,
                COALESCE(SUM(b.doctor_fee * (1 - ? / 100)), 0) as net_earnings
            FROM appointments a
            JOIN bills b ON b.appointment_id = a.id
            WHERE a.doctor_id = ?
              AND a.status = 'COMPLETED'
              AND b.status = 'PAID'
              ${dateFilter}
        `, [commissionRate, commissionRate, user.id]);

        // Per-appointment breakdown
        const appointments: any = await query(`
            SELECT
                a.id as appointment_id,
                a.date,
                u.name as patient_name,
                b.doctor_fee,
                b.doctor_fee * ? / 100 as commission_amount,
                b.doctor_fee * (1 - ? / 100) as net_earned,
                b.status as bill_status,
                b.paid_at
            FROM appointments a
            JOIN bills b ON b.appointment_id = a.id
            JOIN users u ON u.id = a.patient_id
            WHERE a.doctor_id = ?
              AND a.status = 'COMPLETED'
              AND b.status = 'PAID'
              ${dateFilter}
            ORDER BY a.date DESC
        `, [commissionRate, commissionRate, user.id]);

        const s = summaryRows[0];
        return NextResponse.json({
            commission_rate: commissionRate,
            summary: {
                total_appointments: Number(s.total_appointments),
                gross_earned: Number(s.gross_earned),
                center_commission: Number(s.center_commission),
                net_earnings: Number(s.net_earnings),
            },
            appointments,
        });

    } catch (error) {
        console.error('Doctor Earnings Error:', error);
        return NextResponse.json({ message: 'Failed to fetch earnings' }, { status: 500 });
    }
}
