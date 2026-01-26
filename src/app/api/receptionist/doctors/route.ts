
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        const user = await AuthService.verifyToken(token || '');
        if (!user || user.role !== 'RECEPTIONIST') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const doctors = await query(`
            SELECT u.id, u.name, d.specialization 
            FROM users u 
            JOIN doctors d ON u.id = d.user_id 
            WHERE u.role = 'DOCTOR'
            ORDER BY u.name ASC
        `);

        return NextResponse.json(doctors);
    } catch (error) {
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
