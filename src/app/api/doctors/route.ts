
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
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
        `);

        return NextResponse.json(doctors);
    } catch (error) {
        console.error('Fetch Doctors Error:', error);
        return NextResponse.json({ message: 'Error fetching doctors' }, { status: 500 });
    }
}
