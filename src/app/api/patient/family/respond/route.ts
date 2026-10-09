import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { pool } from '@/lib/db';
import { requireRole } from '@/lib/api-auth';
import { nameOf, notify } from '@/lib/notify';
import { z } from 'zod';

const schema = z.object({
    requestId: z.number().int().positive(),
    action: z.enum(['ACCEPT', 'REJECT']),
});

export async function POST(req: Request) {
    const auth = await requireRole('PATIENT');
    if ('error' in auth) return auth.error;
    const { user } = auth;

    try {
        const parsed = schema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ message: 'Invalid payload' }, { status: 400 });
        const { requestId, action } = parsed.data;

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Lock the request so a double-click or two devices cannot process it twice
            const [requests]: any = await connection.execute('SELECT * FROM patient_family_links WHERE id = ? FOR UPDATE', [requestId]);
            if (requests.length === 0) {
                await connection.rollback();
                return NextResponse.json({ message: 'Request not found' }, { status: 404 });
            }
            const request = requests[0];

            // Only the person being asked can answer
            if (request.member_id !== user.id) {
                await connection.rollback();
                return NextResponse.json({ message: 'Unauthorized action' }, { status: 403 });
            }
            if (request.status !== 'PENDING') {
                await connection.rollback();
                return NextResponse.json({ message: 'Request has already been processed' }, { status: 409 });
            }

            if (action === 'REJECT') {
                await connection.execute('UPDATE patient_family_links SET status = "REJECTED" WHERE id = ?', [requestId]);
                await notify(connection, request.requester_id, {
                    type: 'FAMILY_RESPONSE', title: 'Family link declined',
                    body: `${await nameOf(connection, user.id)} declined your family link request.`, link: '/patient/family',
                });
                await connection.commit();
                await audit(user, { action: 'UPDATE', entity: 'FAMILY_LINK', entityId: requestId, patientId: request.requester_id, details: { response: 'REJECT' } });
                return NextResponse.json({ message: 'Request rejected' });
            }

            await connection.execute('UPDATE patient_family_links SET status = "APPROVED" WHERE id = ?', [requestId]);

            // Already linked in either direction (for example by reception)? Then there is nothing more to create.
            const [existing]: any = await connection.execute(
                `SELECT id FROM family_links
                 WHERE (primary_patient_id = ? AND linked_patient_id = ?) OR (primary_patient_id = ? AND linked_patient_id = ?)`,
                [request.member_id, request.requester_id, request.requester_id, request.member_id]);
            if (existing.length === 0) {
                await connection.execute(
                    `INSERT INTO family_links (primary_patient_id, linked_patient_id, relationship, verified_by) VALUES (?, ?, ?, ?)`,
                    [request.member_id, request.requester_id, request.relationship, user.id]);
            }

            await notify(connection, request.requester_id, {
                type: 'FAMILY_RESPONSE', title: 'Family link accepted',
                body: `${await nameOf(connection, user.id)} accepted your family link request. You can now switch between your accounts.`, link: '/patient/family',
            });
            await connection.commit();
            await audit(user, { action: 'UPDATE', entity: 'FAMILY_LINK', entityId: requestId, patientId: request.requester_id, details: { response: 'ACCEPT' } });
            return NextResponse.json({ message: 'Request accepted. Accounts linked successfully.' });
        } catch (err) {
            await connection.rollback().catch(() => {});
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Family Respond Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
