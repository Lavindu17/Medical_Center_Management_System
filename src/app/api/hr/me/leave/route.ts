import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { parseBody } from '@/lib/validate';
import { requireStaff, hrFailure } from '@/lib/hr-auth';
import { balances, leaveTypes, loadSettings, notifyHr, validateLeave } from '@/lib/hr';
import { isDay, localDay } from '@/lib/hr-time';
import { formatDate } from '@/lib/dates';

const schema = z.object({
    leaveTypeId: z.number({ message: 'Choose a leave type' }).int().positive('Choose a leave type'),
    start: z.string().refine(isDay, 'Choose a valid first day'),
    end: z.string().refine(isDay, 'Choose a valid last day'),
    dayPart: z.enum(['FULL', 'FIRST_HALF', 'SECOND_HALF']).default('FULL'),
    reason: z.string().trim().max(500, 'The reason is too long').nullish().transform((v) => v || null),
});

/** Your leave balances for the year and your requests. */
export async function GET(req: Request) {
    const auth = await requireStaff();
    if ('error' in auth) return auth.error;
    try {
        const settings = await loadSettings();
        const year = Number(new URL(req.url).searchParams.get('year')) || Number(localDay(new Date(), settings.timezone).slice(0, 4));
        const requests = await query<any[]>(
            `SELECT r.id, r.leave_type_id AS leaveTypeId, t.name AS typeName, DATE_FORMAT(r.start_date, '%Y-%m-%d') AS start, DATE_FORMAT(r.end_date, '%Y-%m-%d') AS end,
                    r.day_part AS dayPart, r.days, r.reason, r.status, r.decision_note AS decisionNote, d.name AS decidedByName
             FROM leave_requests r JOIN leave_types t ON t.id = r.leave_type_id LEFT JOIN users d ON d.id = r.decided_by
             WHERE r.user_id = ? ORDER BY r.start_date DESC LIMIT 100`, [auth.user.id]);
        return NextResponse.json({ year, balances: await balances(auth.user.id, year), types: await leaveTypes(), requests });
    } catch (err) {
        return hrFailure(err, 'HR my leave');
    }
}

/** Ask for leave. Rules: no overlap, enough balance, half days only where the type allows, holidays are not charged. */
export async function POST(req: Request) {
    const auth = await requireStaff();
    if ('error' in auth) return auth.error;
    const body = await parseBody(req, schema);
    if ('error' in body) return body.error;
    const { leaveTypeId, start, end, dayPart, reason } = body.data;

    try {
        const { days, type } = await validateLeave({ userId: auth.user.id, leaveTypeId, start, end, dayPart, reason });
        const res: any = await query(
            `INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, day_part, days, reason) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [auth.user.id, leaveTypeId, start, end, dayPart, days, reason]);
        await notifyHr(null, 'Leave request', `${auth.user.name} asked for ${days} day${days === 1 ? '' : 's'} of ${type.name.toLowerCase()} from ${formatDate(start)}.`, '/hr/leave', 'LEAVE_REQUEST');
        await audit(auth.user, { action: 'CREATE', entity: 'LEAVE_REQUEST', entityId: res.insertId, details: { type: type.code, start, end, days } });
        return NextResponse.json({ id: res.insertId, days }, { status: 201 });
    } catch (err) {
        return hrFailure(err, 'HR request leave');
    }
}
