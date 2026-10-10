import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { parseBody } from '@/lib/validate';
import { requireStaff, hrFailure } from '@/lib/hr-auth';
import { HrError, loadSettings, notifyHr, punchInstants } from '@/lib/hr';
import { addDays, isDay, isTime, localDay } from '@/lib/hr-time';
import { formatDate } from '@/lib/dates';

const schema = z.object({
    workDate: z.string().refine(isDay, 'Choose a valid day'),
    recordId: z.number().int().positive().nullish(),
    clockIn: z.string().refine(isTime, 'Enter the time you started'),
    clockOut: z.string().refine(isTime, 'Enter a valid finish time').nullish(),
    reason: z.string().trim().min(5, 'Say briefly what happened (at least 5 characters)').max(500, 'The reason is too long'),
});

export async function GET() {
    const auth = await requireStaff();
    if ('error' in auth) return auth.error;
    try {
        const rows = await query<any[]>(
            `SELECT c.id, DATE_FORMAT(c.work_date, '%Y-%m-%d') AS workDate, c.record_id AS recordId, TIME_FORMAT(c.requested_in, '%H:%i') AS clockIn,
                    TIME_FORMAT(c.requested_out, '%H:%i') AS clockOut, c.reason, c.status, c.decision_note AS decisionNote, c.created_at AS createdAt
             FROM attendance_corrections c WHERE c.user_id = ? ORDER BY c.created_at DESC LIMIT 50`, [auth.user.id]);
        return NextResponse.json({ corrections: rows });
    } catch (err) {
        return hrFailure(err, 'HR my corrections');
    }
}

/** Ask HR to fix a day: a missing clock-out, a forgotten clock-in, or wrong times. HR approves it; the original stays on record. */
export async function POST(req: Request) {
    const auth = await requireStaff();
    if ('error' in auth) return auth.error;
    const body = await parseBody(req, schema);
    if ('error' in body) return body.error;
    const { workDate, recordId, clockIn, clockOut, reason } = body.data;

    try {
        const settings = await loadSettings();
        const today = localDay(new Date(), settings.timezone);
        if (workDate > today) throw new HrError(400, 'You cannot correct a day that has not happened yet');
        if (workDate < addDays(today, -31)) throw new HrError(400, 'Corrections can only be requested for the last 31 days. Ask HR.');
        punchInstants(workDate, clockIn, clockOut ?? null, settings.timezone);   // validates the times

        if (recordId) {
            const own = await query<any[]>('SELECT id FROM attendance_records WHERE id = ? AND user_id = ?', [recordId, auth.user.id]);
            if (own.length === 0) throw new HrError(404, 'That clock-in was not found');
        }
        const pending = await query<any[]>(`SELECT id FROM attendance_corrections WHERE user_id = ? AND work_date = ? AND status = 'PENDING'`, [auth.user.id, workDate]);
        if (pending.length > 0) throw new HrError(409, 'You already have a pending correction for that day');

        const res: any = await query(
            `INSERT INTO attendance_corrections (user_id, work_date, record_id, requested_in, requested_out, reason) VALUES (?, ?, ?, ?, ?, ?)`,
            [auth.user.id, workDate, recordId ?? null, clockIn, clockOut ?? null, reason]);
        await notifyHr(null, 'Attendance correction', `${auth.user.name} asked to correct ${formatDate(workDate)}.`, '/hr/attendance', 'ATTENDANCE_CORRECTION');
        await audit(auth.user, { action: 'CREATE', entity: 'CORRECTION', entityId: res.insertId, details: { workDate } });
        return NextResponse.json({ id: res.insertId }, { status: 201 });
    } catch (err) {
        return hrFailure(err, 'HR request correction');
    }
}
