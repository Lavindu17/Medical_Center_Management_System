
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        const user = await AuthService.verifyToken(token || '');
        if (!user || user.role !== 'RECEPTIONIST') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const { patient_id, doctor_id, date, time_slot } = await req.json();

        if (!patient_id || !doctor_id || !date || !time_slot) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        // 1. Check if slot is taken
        const existing = await query(
            'SELECT id FROM appointments WHERE doctor_id = ? AND date = ? AND time_slot = ? AND status != "CANCELLED"',
            [doctor_id, date, time_slot]
        );

        if ((existing as any[]).length > 0) {
            return NextResponse.json({ message: 'Slot already taken' }, { status: 409 });
        }

        // 2. Calculate Queue Number
        const [lastQueue]: any = await query(
            'SELECT MAX(queue_number) as max_q FROM appointments WHERE doctor_id = ? AND date = ?',
            [doctor_id, date]
        );
        const queue_number = (lastQueue[0]?.max_q || 0) + 1;

        // 3. Create Appointment
        const result: any = await query(
            'INSERT INTO appointments (patient_id, doctor_id, date, time_slot, queue_number, status) VALUES (?, ?, ?, ?, ?, "PENDING")',
            [patient_id, doctor_id, date, time_slot, queue_number]
        );

        return NextResponse.json({
            message: 'Appointment Booked',
            appointmentId: result.insertId,
            queue_number
        });

    } catch (error) {
        console.error('Admin Book Error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
