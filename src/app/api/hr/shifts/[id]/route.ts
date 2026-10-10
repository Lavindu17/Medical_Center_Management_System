import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { parseBody } from '@/lib/validate';
import { requireHr, hrFailure } from '@/lib/hr-auth';
import { HrError, checkShiftTimes, loadSettings, loadShifts, toShift } from '@/lib/hr';
import { addDays, isTime, normTime } from '@/lib/hr-time';
import { overlaps } from '@/lib/hr-rules';

const schema = z.object({
    start: z.string().refine(isTime, 'Enter a valid start time'),
    end: z.string().refine(isTime, 'Enter a valid finish time'),
    label: z.string().trim().max(60).nullish().transform((v) => v || null),
});

/** Change the times of one shift. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    const body = await parseBody(req, schema);
    if ('error' in body) return body.error;
    try {
        const id = Number((await params).id);
        if (!Number.isInteger(id) || id <= 0) throw new HrError(400, 'Invalid shift');
        const [shift] = await query<any[]>(`SELECT id, user_id, DATE_FORMAT(shift_date, '%Y-%m-%d') AS shift_date FROM shift_assignments WHERE id = ?`, [id]);
        if (!shift) throw new HrError(404, 'Shift not found');
        checkShiftTimes([body.data]);

        const settings = await loadSettings();
        const others = (await loadShifts([shift.user_id], addDays(shift.shift_date, -1), addDays(shift.shift_date, 1))).filter((s) => s.id !== id);
        const mine = toShift({ id, user_id: shift.user_id, shift_date: shift.shift_date, start_time: normTime(body.data.start), end_time: normTime(body.data.end), label: null }, settings.timezone);
        if (others.some((o) => overlaps(toShift(o, settings.timezone), mine))) throw new HrError(409, 'That overlaps another shift this person has');

        await query('UPDATE shift_assignments SET start_time = ?, end_time = ?, label = ? WHERE id = ?', [normTime(body.data.start), normTime(body.data.end), body.data.label, id]);
        await audit(auth.user, { action: 'UPDATE', entity: 'SHIFT', entityId: id, details: { employeeId: shift.user_id, date: shift.shift_date } });
        return NextResponse.json({ message: 'Shift updated' });
    } catch (err) {
        return hrFailure(err, 'HR update shift');
    }
}
