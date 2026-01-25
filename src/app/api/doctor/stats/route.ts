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
        const today = new Date().toISOString().split('T')[0];

        // Today's Appointments
        const [todayRows]: any = await query(
            'SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND date = ? AND status != "CANCELLED"',
            [user.id, today]
        );

        // Upcoming Appointments
        const [upcomingRows]: any = await query(
            'SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND date > ? AND status != "CANCELLED"',
            [user.id, today]
        );

        // Total Patients (Unique)
        const [patientRows]: any = await query(
            'SELECT COUNT(DISTINCT patient_id) as count FROM appointments WHERE doctor_id = ?',
            [user.id]
        );

        // Revenue (Based on Bills for this doctor)
        // If bills track doctor_fee, use that.
        // Schema: bills -> appointment_id -> doctor_id (via join)
        // Actually bills schema has doctor_fee. We need to join with appointments to filter by doctor_id is NOT in bills table... 
        // Wait, bills table schema:
        // CREATE TABLE `bills` (
        //   `id` INT AUTO_INCREMENT PRIMARY KEY,
        //   `appointment_id` INT NOT NULL UNIQUE,
        //   ...
        //   FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`)
        // )
        // So we need to join appointments to check doctor_id.
        const [revenueRows]: any = await query(
            `SELECT SUM(b.doctor_fee) as total 
             FROM bills b
             JOIN appointments a ON b.appointment_id = a.id
             WHERE a.doctor_id = ? AND b.status = 'PAID'`, // Count only PAID for realized revenue? Or all? Let's do PAID.
            [user.id]
        );

        return NextResponse.json({
            todayAppointments: todayRows[0].count,
            upcomingAppointments: upcomingRows[0].count,
            totalPatients: patientRows[0].count,
            revenue: revenueRows[0].total || 0
        });

    } catch (error) {
        console.error('Doctor Stats Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
