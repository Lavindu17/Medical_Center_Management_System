import { NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';
import { z } from 'zod';
import { requireRole } from '@/lib/api-auth';

// GET all doctors with their financial settings
export async function GET(req: Request) {
    const auth = await requireRole('ADMIN');
    if ('error' in auth) return auth.error;

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
    id: z.number().int().positive(),
    consultationFee: z.number().min(0).max(10_000_000),
    commissionRate: z.number().min(0).max(100),
});

// Update Doctor Fees
export async function PUT(req: Request) {
    const auth = await requireRole('ADMIN');
    if ('error' in auth) return auth.error;

    try {
        const body = await req.json();
        const validation = updateDoctorSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten() }, { status: 400 });
        }

        const { id, consultationFee, commissionRate } = validation.data;

        const result: any = await query(
            'UPDATE doctors SET consultation_fee = ?, commission_rate = ? WHERE user_id = ?',
            [consultationFee, commissionRate, id]
        );
        if (result.affectedRows === 0) {
            // affectedRows is 0 both for "no such doctor" and "values unchanged"
            const exists = await query<any[]>('SELECT user_id FROM doctors WHERE user_id = ?', [id]);
            if (exists.length === 0) return NextResponse.json({ message: 'Doctor not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Doctor updated successfully' });

    } catch (error) {
        console.error('Update Doctor Error:', error);
        return NextResponse.json({ message: 'Failed to update doctor' }, { status: 500 });
    }
}
