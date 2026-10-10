import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { parseBody } from '@/lib/validate';
import { requireHr, hrFailure } from '@/lib/hr-auth';
import { HrError, savePunch } from '@/lib/hr';
import { isDay, isTime } from '@/lib/hr-time';
import { notify } from '@/lib/notify';
import { formatDate } from '@/lib/dates';

const schema = z.object({
    workDate: z.string().refine(isDay, 'Choose a valid day'),
    clockIn: z.string().refine(isTime, 'Enter a valid clock-in time'),
    clockOut: z.string().refine(isTime, 'Enter a valid clock-out time').nullish().transform((v) => v || null),
    reason: z.string().trim().min(5, 'Give a reason (at least 5 characters)').max(255, 'The reason is too long'),
});

async function target(params: Promise<{ id: string }>, actorId: number) {
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) throw new HrError(400, 'Invalid record');
    const [rec] = await query<{ id: number; user_id: number; work_date: string }[]>(`SELECT id, user_id, DATE_FORMAT(work_date, '%Y-%m-%d') AS work_date FROM attendance_records WHERE id = ?`, [id]);
    if (!rec) throw new HrError(404, 'Attendance record not found');
    if (rec.user_id === actorId) throw new HrError(403, 'You cannot edit your own attendance. Ask another HR manager or an administrator.');
    return rec;
}

/** HR changes a session. The reason is kept with the record and in the audit trail. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    const body = await parseBody(req, schema);
    if ('error' in body) return body.error;
    try {
        const rec = await target(params, auth.user.id);
        await savePunch(auth.user.id, 'HR', { recordId: rec.id, userId: rec.user_id, workDate: body.data.workDate, clockInTime: body.data.clockIn, clockOutTime: body.data.clockOut, note: body.data.reason });
        await notify(null, rec.user_id, { type: 'ATTENDANCE_EDITED', title: 'Your attendance was updated', body: `HR changed a session on ${formatDate(body.data.workDate)}.`, link: '/work' });
        await audit(auth.user, { action: 'UPDATE', entity: 'ATTENDANCE', entityId: rec.id, details: { employeeId: rec.user_id, workDate: body.data.workDate, reason: body.data.reason } });
        return NextResponse.json({ message: 'Attendance updated' });
    } catch (err) {
        return hrFailure(err, 'HR edit attendance');
    }
}

/** Delete a session recorded by mistake. A reason is required (?reason=...). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    try {
        const reason = (new URL(req.url).searchParams.get('reason') ?? '').trim();
        if (reason.length < 5) throw new HrError(400, 'Give a reason (at least 5 characters)');
        const rec = await target(params, auth.user.id);
        await query('DELETE FROM attendance_records WHERE id = ?', [rec.id]);
        await audit(auth.user, { action: 'DELETE', entity: 'ATTENDANCE', entityId: rec.id, details: { employeeId: rec.user_id, workDate: rec.work_date, reason: reason.slice(0, 200) } });
        return NextResponse.json({ message: 'Attendance record deleted' });
    } catch (err) {
        return hrFailure(err, 'HR delete attendance');
    }
}
