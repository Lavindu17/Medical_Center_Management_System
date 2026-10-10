import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { requireStaff, hrFailure } from '@/lib/hr-auth';
import { HrError, loadSettings, notifyHr } from '@/lib/hr';
import { localDay } from '@/lib/hr-time';
import { unblockForLeave } from '@/lib/doctor-leave';

/** Withdraw your own request: while it is pending, or after approval as long as it has not started. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireStaff();
    if ('error' in auth) return auth.error;
    try {
        const id = Number((await params).id);
        if (!Number.isInteger(id) || id <= 0) throw new HrError(400, 'Invalid request');
        const [row] = await query<any[]>(`SELECT status, DATE_FORMAT(start_date, '%Y-%m-%d') AS start FROM leave_requests WHERE id = ? AND user_id = ?`, [id, auth.user.id]);
        if (!row) throw new HrError(404, 'Leave request not found');
        if (row.status !== 'PENDING' && row.status !== 'APPROVED') throw new HrError(409, `A ${String(row.status).toLowerCase()} request cannot be cancelled`);
        if (row.status === 'APPROVED' && row.start < localDay(new Date(), (await loadSettings()).timezone)) {
            throw new HrError(409, 'Leave that has already started cannot be cancelled. Ask HR.');
        }

        const result: any = await query(`UPDATE leave_requests SET status = 'CANCELLED' WHERE id = ? AND user_id = ? AND status IN ('PENDING','APPROVED')`, [id, auth.user.id]);
        if (result.affectedRows !== 1) throw new HrError(409, 'This request has just changed. Refresh and try again.');
        if (row.status === 'APPROVED') {
            await unblockForLeave(id);
            await notifyHr(null, 'Leave cancelled', `${auth.user.name} cancelled approved leave.`, '/hr/leave', 'LEAVE_REQUEST');
        }
        await audit(auth.user, { action: 'STATUS_CHANGE', entity: 'LEAVE_REQUEST', entityId: id, details: { from: row.status, to: 'CANCELLED' } });
        return NextResponse.json({ message: 'Leave request cancelled' });
    } catch (err) {
        return hrFailure(err, 'HR cancel leave');
    }
}
