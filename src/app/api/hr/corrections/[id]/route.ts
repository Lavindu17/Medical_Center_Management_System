import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { parseBody } from '@/lib/validate';
import { requireHr, hrFailure } from '@/lib/hr-auth';
import { HrError, savePunch } from '@/lib/hr';
import { notify } from '@/lib/notify';
import { formatDate } from '@/lib/dates';

const schema = z.object({
    decision: z.enum(['APPROVE', 'REJECT'], { message: 'Choose approve or reject' }),
    note: z.string().trim().max(500).nullish().transform((v) => v || null),
});

/** Approve (the session is created or changed, and marked as a correction) or reject. You cannot decide your own request. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    const body = await parseBody(req, schema);
    if ('error' in body) return body.error;
    try {
        const id = Number((await params).id);
        if (!Number.isInteger(id) || id <= 0) throw new HrError(400, 'Invalid request');
        const [c] = await query<any[]>(
            `SELECT id, user_id, DATE_FORMAT(work_date, '%Y-%m-%d') AS work_date, record_id, TIME_FORMAT(requested_in, '%H:%i') AS requested_in,
                    TIME_FORMAT(requested_out, '%H:%i') AS requested_out, status FROM attendance_corrections WHERE id = ?`, [id]);
        if (!c) throw new HrError(404, 'Correction not found');
        if (c.status !== 'PENDING') throw new HrError(409, 'This request has already been decided');
        if (c.user_id === auth.user.id) throw new HrError(403, 'You cannot decide your own request. Ask another HR manager or an administrator.');

        const approve = body.data.decision === 'APPROVE';
        if (approve) {
            await savePunch(auth.user.id, 'CORRECTION', {
                recordId: c.record_id, userId: c.user_id, workDate: c.work_date, clockInTime: c.requested_in, clockOutTime: c.requested_out, note: 'Approved correction',
            });
        }
        const res: any = await query(
            `UPDATE attendance_corrections SET status = ?, decided_by = ?, decided_at = NOW(), decision_note = ? WHERE id = ? AND status = 'PENDING'`,
            [approve ? 'APPROVED' : 'REJECTED', auth.user.id, body.data.note, id]);
        if (res.affectedRows !== 1) throw new HrError(409, 'This request has just been decided by someone else');

        await notify(null, c.user_id, {
            type: 'ATTENDANCE_CORRECTION', title: approve ? 'Correction approved' : 'Correction declined',
            body: `Your correction for ${formatDate(c.work_date)} was ${approve ? 'approved' : 'declined'}.${body.data.note ? ` ${body.data.note}` : ''}`, link: '/work',
        });
        await audit(auth.user, { action: 'STATUS_CHANGE', entity: 'CORRECTION', entityId: id, details: { employeeId: c.user_id, to: approve ? 'APPROVED' : 'REJECTED' } });
        return NextResponse.json({ message: approve ? 'Correction approved' : 'Correction declined' });
    } catch (err) {
        return hrFailure(err, 'HR decide correction');
    }
}
