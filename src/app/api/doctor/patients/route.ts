import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search') || '';

        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        const user = await AuthService.verifyToken(token || '');
        if (!user || user.role !== 'DOCTOR') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        if (!search) {
            // Return empty or recent? Let's return recent 10.
            const rows = await query(`
                SELECT u.id, u.name, u.phone, u.email, p.date_of_birth, p.gender 
                FROM users u 
                JOIN patients p ON u.id = p.user_id 
                WHERE u.role = 'PATIENT' 
                ORDER BY u.created_at DESC LIMIT 10
            `);
            return NextResponse.json(rows);
        }

        const rows = await query(`
            SELECT u.id, u.name, u.phone, u.email, p.date_of_birth, p.gender 
            FROM users u 
            JOIN patients p ON u.id = p.user_id 
            WHERE u.role = 'PATIENT' 
            AND (u.name LIKE ? OR u.phone LIKE ?)
            LIMIT 20
        `, [`%${search}%`, `%${search}%`]);

        return NextResponse.json(rows);

    } catch (error) {
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
