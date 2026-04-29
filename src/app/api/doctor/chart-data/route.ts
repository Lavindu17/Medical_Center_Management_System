import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

export async function GET(req: Request) {
    try {
        // 1. Authenticate
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const user = await AuthService.verifyToken(token);
        if (!user || user.role !== 'DOCTOR') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // 2. Fetch Doctor Fee
        const docFeeRows = await query<any[]>('SELECT consultation_fee FROM doctors WHERE user_id = ?', [user.id]);
        const fee = docFeeRows[0]?.consultation_fee || 0;

        // 3. Generate last 7 days array
        const chartData = [];
        const today = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
            const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' }); // Mon, Tue, etc.
            chartData.push({
                dateStr: dateStr,
                day: dayStr,
                appointments: 0,
                revenue: 0
            });
        }

        const startDate = chartData[0].dateStr;
        const endDate = chartData[6].dateStr;

        // 4. Fetch Appointments for the last 7 days
        const apptRows = await query<any[]>(
            `SELECT DATE_FORMAT(date, "%Y-%m-%d") as appt_date, COUNT(*) as count 
             FROM appointments 
             WHERE doctor_id = ? 
             AND DATE_FORMAT(date, "%Y-%m-%d") >= ? 
             AND DATE_FORMAT(date, "%Y-%m-%d") <= ? 
             AND status != "CANCELLED"
             GROUP BY appt_date`,
            [user.id, startDate, endDate]
        );

        // 5. Merge database results with chart array
        apptRows.forEach(row => {
            const match = chartData.find(d => d.dateStr === row.appt_date);
            if (match) {
                match.appointments = row.count;
                match.revenue = row.count * fee;
            }
        });

        // 6. Format final output
        const finalData = chartData.map(({ day, appointments, revenue }) => ({
            day,
            appointments,
            revenue
        }));

        return NextResponse.json(finalData);

    } catch (error) {
        console.error('Chart Data API Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
