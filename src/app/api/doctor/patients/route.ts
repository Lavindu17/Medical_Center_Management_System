import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { audit } from '@/lib/audit';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

/** A doctor's patients are the ones who have an appointment with them: not every patient in the system. */
const OWN_PATIENT = 'EXISTS (SELECT 1 FROM appointments own WHERE own.patient_id = u.id AND own.doctor_id = ?)';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search') || '';

        const auth = await requirePermission('doctor.patients', 'view');
        if ('error' in auth) return auth.error;
        const user = auth.user;

        if (!search) {
            // Return empty or recent? Let's return recent 10.
            const rows = await query(`
                SELECT u.id, u.name, u.phone, u.email, p.date_of_birth, p.gender 
                FROM users u 
                JOIN patients p ON u.id = p.user_id 
                WHERE u.role = 'PATIENT' AND ${OWN_PATIENT}
                ORDER BY u.created_at DESC LIMIT 10
            `, [user.id]);
            await audit(user, { action: 'SEARCH', entity: 'PATIENT_CHART', details: { term: false, results: (rows as any[]).length } });
            return NextResponse.json(rows);
        }

        const like = `%${search.replace(/[%_\\]/g, '\\$&')}%`;
        const rows = await query(`
            SELECT u.id, u.name, u.phone, u.email, p.date_of_birth, p.gender 
            FROM users u 
            JOIN patients p ON u.id = p.user_id 
            WHERE u.role = 'PATIENT' AND ${OWN_PATIENT}
            AND (u.name LIKE ? OR u.phone LIKE ?)
            LIMIT 20
        `, [user.id, like, like]);

        await audit(user, { action: 'SEARCH', entity: 'PATIENT_CHART', details: { term: true, termLength: search.length, results: (rows as any[]).length } });
        return NextResponse.json(rows);

    } catch (error) {
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
