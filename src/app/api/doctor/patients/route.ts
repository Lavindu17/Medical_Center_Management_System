import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { audit } from '@/lib/audit';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search') || '';

        const auth = await requireRole('DOCTOR');
        if ('error' in auth) return auth.error;
        const user = auth.user;

        if (!search) {
            // Return empty or recent? Let's return recent 10.
            const rows = await query(`
                SELECT u.id, u.name, u.phone, u.email, p.date_of_birth, p.gender 
                FROM users u 
                JOIN patients p ON u.id = p.user_id 
                WHERE u.role = 'PATIENT' 
                ORDER BY u.created_at DESC LIMIT 10
            `);
            await audit(user, { action: 'SEARCH', entity: 'PATIENT_CHART', details: { term: false, results: (rows as any[]).length } });
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

        await audit(user, { action: 'SEARCH', entity: 'PATIENT_CHART', details: { term: true, termLength: search.length, results: (rows as any[]).length } });
        return NextResponse.json(rows);

    } catch (error) {
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
