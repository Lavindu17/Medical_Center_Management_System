import { NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';
import { z } from 'zod';

const appointmentSchema = z.object({
    patientId: z.number(),
    doctorId: z.number(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timeSlot: z.string(),
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const validation = appointmentSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten() }, { status: 400 });
        }

        const { patientId, doctorId, date, timeSlot } = validation.data;

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // 1. Check if slot is already taken (Race condition check)
            const [existing]: any = await connection.execute(
                'SELECT id FROM appointments WHERE doctor_id = ? AND date = ? AND time_slot = ? AND status != "CANCELLED" FOR UPDATE',
                [doctorId, date, timeSlot]
            );

            if (existing.length > 0) {
                throw new Error('This time slot has just been booked. Please choose another.');
            }

            // 2. Calculate Queue Number
            const [rows]: any = await connection.execute(
                'SELECT MAX(queue_number) as maxQueue FROM appointments WHERE doctor_id = ? AND date = ?',
                [doctorId, date]
            );
            const nextQueue = (rows[0].maxQueue || 0) + 1;

            // 3. Insert Appointment
            await connection.execute(
                'INSERT INTO appointments (patient_id, doctor_id, date, time_slot, queue_number, status) VALUES (?, ?, ?, ?, ?, "PENDING")',
                [patientId, doctorId, date, timeSlot, nextQueue]
            );

            await connection.commit();

            return NextResponse.json({
                message: 'Appointment booked successfully',
                appointment: { date, timeSlot, queueNumber: nextQueue }
            }, { status: 201 });

        } catch (err: any) {
            await connection.rollback();
            return NextResponse.json({ message: err.message || 'Booking failed' }, { status: 409 });
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Booking Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

// Fetch Appointments (for Patient or Doctor)
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const patientId = searchParams.get('patientId');
        const doctorId = searchParams.get('doctorId');

        let sql = `
      SELECT 
        a.id, 
        a.date, 
        a.time_slot as timeSlot, 
        a.queue_number as queueNumber, 
        a.status,
        d_user.name as doctorName,
        d.specialization
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.user_id
      JOIN users d_user ON d.user_id = d_user.id
    `;

        const params: any[] = [];

        if (patientId) {
            sql += ' WHERE a.patient_id = ?';
            params.push(patientId);
        } else if (doctorId) {
            sql += ' WHERE a.doctor_id = ?';
            params.push(doctorId);
        } else {
            return NextResponse.json({ message: 'Patient or Doctor ID required' }, { status: 400 });
        }

        sql += ' ORDER BY a.date DESC, a.time_slot ASC';

        const appointments = await query<any[]>(sql, params);
        return NextResponse.json(appointments);

    } catch (error) {
        console.error('Fetch Appointments Error:', error);
        return NextResponse.json({ message: 'Failed to fetch appointments' }, { status: 500 });
    }
}
