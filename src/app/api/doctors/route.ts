import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
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
        `);

        return NextResponse.json(doctors);
    } catch (error) {
        console.error('Error fetching doctors:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
