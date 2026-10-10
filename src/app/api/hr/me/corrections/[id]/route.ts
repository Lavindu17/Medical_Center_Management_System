import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { requireStaff, hrFailure } from '@/lib/hr-auth';
import { HrError } from '@/lib/hr';

/** Withdraw your own pending correction. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireStaff();
    if ('error' in auth) return auth.error;
    try {
        const id = Number((await params).id);
        if (!Number.isInteger(id) || id <= 0) throw new HrError(400, 'Invalid request');
        const result: any = await query(`UPDATE attendance_corrections SET status = 'CANCELLED' WHERE id = ? AND user_id = ? AND status = 'PENDING'`, [id, auth.user.id]);
        if (result.affectedRows !== 1) throw new HrError(409, 'Only a pending correction can be withdrawn');
        await audit(auth.user, { action: 'STATUS_CHANGE', entity: 'CORRECTION', entityId: id, details: { to: 'CANCELLED' } });
        return NextResponse.json({ message: 'Correction withdrawn' });
    } catch (err) {
        return hrFailure(err, 'HR cancel correction');
    }
}
