
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        const user = await AuthService.verifyToken(token || '');
        if (!user || user.role !== 'RECEPTIONIST') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const { primary_patient_id, linked_patient_id, relationship } = await req.json();

        if (!primary_patient_id || !linked_patient_id || !relationship) {
            return NextResponse.json({ message: 'Missing fields' }, { status: 400 });
        }

        if (primary_patient_id === linked_patient_id) {
            return NextResponse.json({ message: 'Cannot link patient to themselves' }, { status: 400 });
        }

        await query(
            `INSERT INTO family_links (primary_patient_id, linked_patient_id, relationship, verified_by) 
             VALUES (?, ?, ?, ?)`,
            [primary_patient_id, linked_patient_id, relationship, user.id]
        );

        return NextResponse.json({ message: 'Patients Linked Successfully' });
    } catch (error: any) {
        if (error.code === 'ER_DUP_ENTRY') {
            return NextResponse.json({ message: 'Already linked' }, { status: 409 });
        }
        console.error('Link Error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
