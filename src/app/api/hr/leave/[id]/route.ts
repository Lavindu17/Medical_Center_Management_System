import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { parseBody } from '@/lib/validate';
import { requireHr, hrFailure } from '@/lib/hr-auth';
import { HrError, validateLeave } from '@/lib/hr';
import { blockDoctorDay } from '@/lib/doctor-leave';
import { notify } from '@/lib/notify';
import { formatDate } from '@/lib/dates';

const schema = z.object({
    decision: z.enum(['APPROVE', 'REJECT'], { message: 'Choose approve or reject' }),
    note: z.string().trim().max(500).nullish().transform((v) => v || null),
    // HR may correct the number of days charged (for example a request that spans a day the clinic is closed)
    days: z.number().min(0.5).max(366).refine((n) => n * 2 === Math.round(n * 2), 'Days go up in halves').optional(),
});

/**
 * Approve or reject. Approval re-checks overlap and balance (something may have changed since the request), charges the days, and
 * for a doctor blocks those days for patient bookings. Nobody can decide their own request.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    const body = await parseBody(req, schema);
    if ('error' in body) return body.error;
    try {
        const id = Number((await params).id);
        if (!Number.isInteger(id) || id <= 0) throw new HrError(400, 'Invalid request');
        const [r] = await query<any[]>(
            `SELECT r.id, r.user_id, r.leave_type_id, DATE_FORMAT(r.start_date, '%Y-%m-%d') AS start, DATE_FORMAT(r.end_date, '%Y-%m-%d') AS end, r.day_part, r.days, r.reason, r.status,
                    u.role, u.name, t.name AS type_name
             FROM leave_requests r JOIN users u ON u.id = r.user_id JOIN leave_types t ON t.id = r.leave_type_id WHERE r.id = ?`, [id]);
        if (!r) throw new HrError(404, 'Leave request not found');
        if (r.status !== 'PENDING') throw new HrError(409, `This request is already ${String(r.status).toLowerCase()}`);
        if (r.user_id === auth.user.id) throw new HrError(403, 'You cannot decide your own request. Ask another HR manager or an administrator.');

        const approve = body.data.decision === 'APPROVE';
        let days = Number(r.days);
        let blocked = 0, affectedAppointments = 0;

        if (approve) {
            const check = await validateLeave(
                { userId: r.user_id, leaveTypeId: r.leave_type_id, start: r.start, end: r.end, dayPart: r.day_part, reason: r.reason },
                { ignoreRequestId: id, skipPastCheck: true, days: body.data.days });
            days = check.days;

            const res: any = await query(
                `UPDATE leave_requests SET status = 'APPROVED', days = ?, decided_by = ?, decided_at = NOW(), decision_note = ? WHERE id = ? AND status = 'PENDING'`,
                [days, auth.user.id, body.data.note, id]);
            if (res.affectedRows !== 1) throw new HrError(409, 'This request has just been decided by someone else');

            // A doctor on full-day leave cannot be booked by patients on those days
            if (r.role === 'DOCTOR' && r.day_part === 'FULL') {
                for (const date of check.dates) {
                    const result = await blockDoctorDay(r.user_id, date, `On ${String(r.type_name).toLowerCase()}`, id);
                    if (!result.alreadyOnLeave) blocked++;
                    affectedAppointments += result.affected;
                }
            }
        } else {
            const res: any = await query(
                `UPDATE leave_requests SET status = 'REJECTED', decided_by = ?, decided_at = NOW(), decision_note = ? WHERE id = ? AND status = 'PENDING'`,
                [auth.user.id, body.data.note, id]);
            if (res.affectedRows !== 1) throw new HrError(409, 'This request has just been decided by someone else');
        }

        await notify(null, r.user_id, {
            type: 'LEAVE_DECISION', title: approve ? 'Leave approved' : 'Leave declined',
            body: `Your ${String(r.type_name).toLowerCase()} from ${formatDate(r.start)}${r.end !== r.start ? ` to ${formatDate(r.end)}` : ''} was ${approve ? 'approved' : 'declined'}.${body.data.note ? ` ${body.data.note}` : ''}`,
            link: '/work',
        });
        await audit(auth.user, {
            action: 'STATUS_CHANGE', entity: 'LEAVE_REQUEST', entityId: id,
            details: { employeeId: r.user_id, to: approve ? 'APPROVED' : 'REJECTED', days, daysChangedByHr: approve && body.data.days !== undefined && body.data.days !== Number(r.days), blockedDoctorDays: blocked },
        });
        return NextResponse.json({ message: approve ? 'Leave approved' : 'Leave declined', days, blockedDoctorDays: blocked, affectedAppointments });
    } catch (err) {
        return hrFailure(err, 'HR decide leave');
    }
}
