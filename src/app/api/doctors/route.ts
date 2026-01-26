<<<<<<< HEAD
=======

>>>>>>> fix/doctor-dashboard
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
<<<<<<< HEAD
        // Fetch doctors with their user details
        const doctors: any = await query(`
            SELECT 
                d.id, 
                u.name, 
                d.specialization, 
                d.consultation_fee 
            FROM doctors d 
            JOIN users u ON d.user_id = u.id 
            WHERE u.role = 'doctor'
=======
        // Depending on requirements, we might want to verify auth here too.
        // For now, let's assume any logged in user can see the doctor list.
        // Or even public. Let's keep it simple and just return the list.
        // In a real app, strict auth is better.

        const doctors = await query(`
            SELECT u.id, u.name, d.specialization 
            FROM users u 
            JOIN doctors d ON u.id = d.user_id 
            WHERE u.role = 'DOCTOR'
            ORDER BY u.name ASC
>>>>>>> fix/doctor-dashboard
        `);

        return NextResponse.json(doctors);
    } catch (error) {
<<<<<<< HEAD
        console.error('Error fetching doctors:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
=======
        console.error('Fetch Doctors Error:', error);
        return NextResponse.json({ message: 'Error fetching doctors' }, { status: 500 });
>>>>>>> fix/doctor-dashboard
    }
}
