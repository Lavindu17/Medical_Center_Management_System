import { NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

// Helper
async function getPatient() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;
    const user = await AuthService.verifyToken(token);
    if (!user || user.role !== 'PATIENT') return null;
    return user;
}

export async function POST(req: Request) {
    try {
        const user = await getPatient();
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { requestId, action } = body; // action: 'ACCEPT' | 'REJECT'

        if (!requestId || !['ACCEPT', 'REJECT'].includes(action)) {
            return NextResponse.json({ message: 'Invalid payload' }, { status: 400 });
        }

        // Fetch the request
        const requests = await query<any[]>('SELECT * FROM patient_family_links WHERE id = ?', [requestId]);
        if (requests.length === 0) return NextResponse.json({ message: 'Request not found' }, { status: 404 });
        
        const request = requests[0];

        // Ensure the current user is the TARGET (member_id) of this request
        if (request.member_id !== user.id) {
            return NextResponse.json({ message: 'Unauthorized action' }, { status: 403 });
        }

        if (request.status !== 'PENDING') {
            return NextResponse.json({ message: 'Request has already been processed' }, { status: 400 });
        }

        if (action === 'REJECT') {
            await query('UPDATE patient_family_links SET status = "REJECTED" WHERE id = ?', [requestId]);
            return NextResponse.json({ message: 'Request rejected' });
        }

        // Processing ACCEPT action
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Update request status
            await connection.execute('UPDATE patient_family_links SET status = "APPROVED" WHERE id = ?', [requestId]);

            // Insert official family link
            await connection.execute(
                `INSERT INTO family_links (primary_patient_id, linked_patient_id, relationship, verified_by) 
                 VALUES (?, ?, ?, ?)`,
                [request.member_id, request.requester_id, request.relationship, user.id]
            );

            await connection.commit();
            return NextResponse.json({ message: 'Request accepted. Accounts linked successfully.' });

        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Family Respond Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
