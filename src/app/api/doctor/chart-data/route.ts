import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireRole } from '@/lib/api-auth';

interface DayPoint {
    dateStr: string;
    day: string;
    appointments: number;
    revenue: number;
}

export async function GET() {
    const auth = await requireRole('DOCTOR');
    if ('error' in auth) return auth.error;
    const { user } = auth;

    try {
        // The last 7 days including today, oldest first
        const chartData: DayPoint[] = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            chartData.push({
                dateStr: d.toLocaleDateString('en-CA'),                         // YYYY-MM-DD
                day: d.toLocaleDateString('en-US', { weekday: 'short' }),       // Mon, Tue, ...
                appointments: 0,
                revenue: 0,
            });
        }

        // Appointments per day, and the doctor's fee on bills that have actually been paid for completed visits
        const rows = await query<any[]>(
            `SELECT DATE_FORMAT(a.date, '%Y-%m-%d') AS appt_date,
                    COUNT(*) AS count,
                    COALESCE(SUM(CASE WHEN a.status = 'COMPLETED' AND b.status = 'PAID' THEN b.doctor_fee ELSE 0 END), 0) AS revenue
             FROM appointments a
             LEFT JOIN bills b ON b.appointment_id = a.id
             WHERE a.doctor_id = ? AND a.date BETWEEN ? AND ? AND a.status != 'CANCELLED'
             GROUP BY appt_date`,
            [user.id, chartData[0].dateStr, chartData[6].dateStr]
        );

        for (const row of rows) {
            const match = chartData.find(d => d.dateStr === row.appt_date);
            if (match) {
                match.appointments = Number(row.count);
                match.revenue = Number(row.revenue);
            }
        }

        return NextResponse.json(chartData.map(({ day, appointments, revenue }) => ({ day, appointments, revenue })));

    } catch (error) {
        console.error('Chart Data API Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
