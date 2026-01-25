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

        // 2. Fetch Stats
        // Use Local Date YYYY-MM-DD
        const today = new Date().toLocaleDateString('en-CA');

        // Today's Appointments
        // Use DATE_FORMAT to match only the date part string-wise
        const todayRows = await query<any[]>(
            'SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND DATE_FORMAT(date, "%Y-%m-%d") = ? AND status != "CANCELLED"',
            [user.id, today]
        );

        // Upcoming Appointments
        const upcomingRows = await query<any[]>(
            'SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND DATE_FORMAT(date, "%Y-%m-%d") > ? AND status != "CANCELLED"',
            [user.id, today]
        );

        // Total Patients (Unique)
        const patientRows = await query<any[]>(
            'SELECT COUNT(DISTINCT patient_id) as count FROM appointments WHERE doctor_id = ?',
            [user.id]
        );

        // Revenue Calculation
        // Option A: Realized (Paid Bills) -> Might be 0 if billing not used yet.
        // Option B: Projected (Appointments * Fee). Let's use Projected for better UX now.

        // Get Doctor Fee
        const docFeeRows = await query<any[]>('SELECT consultation_fee FROM doctors WHERE user_id = ?', [user.id]);
        const fee = docFeeRows[0]?.consultation_fee || 0;

        // Count all valid appointments (Past + Future)
        const totalApptRows = await query<any[]>(
            'SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND status != "CANCELLED"',
            [user.id]
        );

        const totalRevenue = totalApptRows[0].count * fee;

        return NextResponse.json({
            todayAppointments: todayRows[0].count,
            upcomingAppointments: upcomingRows[0].count,
            totalPatients: patientRows[0].count,
            revenue: totalRevenue // Projected Revenue
        });

    } catch (error) {
        console.error('Doctor Stats Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
