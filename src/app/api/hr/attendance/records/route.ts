import { NextResponse } from 'next/server';
import { z } from 'zod';
import { audit } from '@/lib/audit';
import { parseBody } from '@/lib/validate';
import { requireHr, hrFailure } from '@/lib/hr-auth';
import { HrError, STAFF_ROLES, savePunch } from '@/lib/hr';
import { isDay, isTime } from '@/lib/hr-time';
import { query } from '@/lib/db';
import { notify } from '@/lib/notify';
import { formatDate } from '@/lib/dates';

const punchSchema = z.object({
    userId: z.number().int().positive(),
    workDate: z.string().refine(isDay, 'Choose a valid day'),
    clockIn: z.string().refine(isTime, 'Enter a valid clock-in time'),
    clockOut: z.string().refine(isTime, 'Enter a valid clock-out time').nullish().transform((v) => v || null),
    reason: z.string().trim().min(5, 'Give a reason (at least 5 characters)').max(255, 'The reason is too long'),
});

/** HR adds a missing session for someone. A reason is required, and it is audited. You cannot edit your own attendance. */
export async function POST(req: Request) {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    const body = await parseBody(req, punchSchema);
    if ('error' in body) return body.error;
    try {
        const { userId, workDate, clockIn, clockOut, reason } = body.data;
        if (userId === auth.user.id) throw new HrError(403, 'You cannot edit your own attendance. Ask another HR manager or an administrator.');
        const target = await query<{ id: number }[]>(`SELECT id FROM users WHERE id = ? AND role IN (${STAFF_ROLES.map(() => '?').join(',')})`, [userId, ...STAFF_ROLES]);
        if (target.length === 0) throw new HrError(404, 'Employee not found');
        const id = await savePunch(auth.user.id, 'HR', { userId, workDate, clockInTime: clockIn, clockOutTime: clockOut, note: reason });
        await notify(null, userId, { type: 'ATTENDANCE_EDITED', title: 'Your attendance was updated', body: `HR recorded a session for ${formatDate(workDate)}.`, link: '/work' });
        await audit(auth.user, { action: 'CREATE', entity: 'ATTENDANCE', entityId: id, details: { employeeId: userId, workDate, reason } });
        return NextResponse.json({ id }, { status: 201 });
    } catch (err) {
        return hrFailure(err, 'HR add attendance');
    }
}
