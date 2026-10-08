
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

export async function GET() {
    try {
        const auth = await requireRole('RECEPTIONIST');
        if ('error' in auth) return auth.error;
        const user = auth.user;

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
