
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

async function checkAuth() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    const user = await AuthService.verifyToken(token || '');
    if (!user || user.role !== 'RECEPTIONIST') return false;
    return true;
}

export async function GET(req: Request) {
    try {
        if (!await checkAuth()) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const date = searchParams.get('date'); // YYYY-MM-DD
        const doctorId = searchParams.get('doctorId');

        let sql = `
            SELECT 
                a.id,
                a.date,
                a.time_slot,
                a.queue_number,
                a.status,
                p.name as patient_name,
                p.phone as patient_phone,
                d.name as doctor_name,
                doc.specialization
            FROM appointments a
            JOIN users p ON a.patient_id = p.id
            JOIN users d ON a.doctor_id = d.id
            JOIN doctors doc ON a.doctor_id = doc.user_id
            WHERE 1=1
        `;

        const params: any[] = [];

        if (date) {
            sql += ` AND a.date = ?`;
            params.push(date);
        } else {
            // Default to today if no date? Or generally filter required?
            // Let's default to today if not provided to keep list manageable
            const today = new Date().toISOString().split('T')[0];
            sql += ` AND a.date = ?`;
            params.push(today);
        }

        if (doctorId && doctorId !== 'all') {
            sql += ` AND a.doctor_id = ?`;
            params.push(doctorId);
        }

        sql += ` ORDER BY a.time_slot ASC, a.queue_number ASC`;

        const appointments = await query(sql, params);
        return NextResponse.json(appointments);
    } catch (error) {
        console.error('Fetch Appointments Error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
