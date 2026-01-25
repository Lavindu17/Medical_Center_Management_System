import { NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';
import { z } from 'zod';

// GET all doctors with their financial settings
export async function GET(req: Request) {
    try {
        const doctors = await query<any[]>(`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.phone,
        d.specialization,
        d.license_number as licenseNumber,
        d.consultation_fee as consultationFee,
        d.commission_rate as commissionRate
      FROM users u
      JOIN doctors d ON u.id = d.user_id
      WHERE u.role = 'DOCTOR'
    `);

        // In a real scenario, we would also aggregate earnings from bills here
        // e.g., (SUM(doctor_fee) * commission_rate / 100)

        return NextResponse.json(doctors);
    } catch (error) {
        console.error('Fetch Doctors Error:', error);
        return NextResponse.json({ message: 'Failed to fetch doctors' }, { status: 500 });
    }
}

const updateDoctorSchema = z.object({
    id: z.number(),
    consultationFee: z.number().min(0),
    commissionRate: z.number().min(0).max(100),
});

// Update Doctor Fees
export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const validation = updateDoctorSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten() }, { status: 400 });
        }

        const { id, consultationFee, commissionRate } = validation.data;

        await query(
            'UPDATE doctors SET consultation_fee = ?, commission_rate = ? WHERE user_id = ?',
            [consultationFee, commissionRate, id]
        );

        return NextResponse.json({ message: 'Doctor updated successfully' });

    } catch (error) {
        console.error('Update Doctor Error:', error);
        return NextResponse.json({ message: 'Failed to update doctor' }, { status: 500 });
    }
}
