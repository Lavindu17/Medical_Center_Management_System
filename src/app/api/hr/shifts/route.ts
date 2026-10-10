import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { parseBody } from '@/lib/validate';
import { requireHr, hrFailure } from '@/lib/hr-auth';
import { HrError, createShifts, loadHolidays, loadLeave, loadSettings, loadShifts } from '@/lib/hr';
import { eachDay, isDay, isTime, weekday } from '@/lib/hr-time';
import { notify } from '@/lib/notify';
import { formatDate } from '@/lib/dates';

/** The roster for a date range (default one week), with approved leave and holidays so the grid can show them. */
export async function GET(req: Request) {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    try {
        const p = new URL(req.url).searchParams;
        const from = p.get('from') ?? '', to = p.get('to') ?? '';
        if (!isDay(from) || !isDay(to) || to < from) throw new HrError(400, 'Choose a valid date range');
        if (eachDay(from, to).length > 62) throw new HrError(400, 'Choose at most two months at a time');
        const settings = await loadSettings();
        const [shifts, leave, holidays] = await Promise.all([loadShifts(null, from, to), loadLeave(null, from, to, ['APPROVED', 'PENDING']), loadHolidays(from, to)]);
        return NextResponse.json({
            timezone: settings.timezone, shifts, holidays: [...holidays].map(([date, name]) => ({ date, name })),
            leave: leave.map((l) => ({ userId: l.user_id, start: l.start_date, end: l.end_date, dayPart: l.day_part, type: l.type_name, status: l.status })),
        });
    } catch (err) {
        return hrFailure(err, 'HR roster');
    }
}

const timeRow = z.object({
    start: z.string().refine(isTime, 'Enter a valid start time'),
    end: z.string().refine(isTime, 'Enter a valid finish time'),
    label: z.string().trim().max(60).nullish(),
});

const schema = z.object({
    userIds: z.array(z.number().int().positive()).min(1, 'Choose at least one person').max(300),
    // Either explicit dates, or a range with the weekdays to include (0 = Sunday)
    dates: z.array(z.string().refine(isDay)).max(366).optional(),
    range: z.object({
        from: z.string().refine(isDay, 'Choose a valid first date'),
        to: z.string().refine(isDay, 'Choose a valid last date'),
        weekdays: z.array(z.number().int().min(0).max(6)).min(1, 'Choose at least one weekday'),
    }).optional(),
    times: z.array(timeRow).min(1, 'Add at least one shift').max(8),
}).refine((v) => v.dates?.length || v.range, { message: 'Choose the dates' });

/** Add shifts for one or several people. Anything that cannot be added is skipped and reported. */
export async function POST(req: Request) {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    const body = await parseBody(req, schema);
    if ('error' in body) return body.error;
    try {
        const { userIds, times, range } = body.data;
        let dates = body.data.dates ?? [];
        if (range) {
            if (range.to < range.from) throw new HrError(400, 'The last date cannot be before the first date');
            if (eachDay(range.from, range.to).length > 366) throw new HrError(400, 'Choose at most a year at a time');
            dates = eachDay(range.from, range.to).filter((d) => range.weekdays.includes(weekday(d)));
            if (dates.length === 0) throw new HrError(400, 'No days in that range match the weekdays you chose');
        }
        const settings = await loadSettings();
        const result = await createShifts(auth.user.id, { userIds, dates, times }, settings.timezone);
        if (result.created > 0) {
            const first = [...dates].sort()[0];
            await notify(null, userIds, { type: 'SHIFT_ASSIGNED', title: 'Your roster changed', body: `New shifts were added to your roster from ${formatDate(first)}.`, link: '/work' });
        }
        await audit(auth.user, { action: 'CREATE', entity: 'SHIFT', details: { people: userIds.length, days: dates.length, shiftsPerDay: times.length, created: result.created, skipped: result.skipped.length } });
        return NextResponse.json(result, { status: result.created > 0 ? 201 : 200 });
    } catch (err) {
        return hrFailure(err, 'HR add shifts');
    }
}

const deleteSchema = z.object({ ids: z.array(z.number().int().positive()).min(1).max(1000) });

/** Remove shifts (for example a whole week of one person). */
export async function DELETE(req: Request) {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    const body = await parseBody(req, deleteSchema);
    if ('error' in body) return body.error;
    try {
        const ids = body.data.ids;
        // A shift someone has already clocked into stays: it is part of the attendance record
        const used = await query<{ shift_id: number }[]>(`SELECT DISTINCT shift_id FROM attendance_records WHERE shift_id IN (${ids.map(() => '?').join(',')})`, ids);
        const usedIds = new Set(used.map((u) => u.shift_id));
        const deletable = ids.filter((i) => !usedIds.has(i));
        let removed = 0;
        if (deletable.length > 0) {
            const res: any = await query(`DELETE FROM shift_assignments WHERE id IN (${deletable.map(() => '?').join(',')})`, deletable);
            removed = res.affectedRows;
        }
        await audit(auth.user, { action: 'DELETE', entity: 'SHIFT', details: { requested: ids.length, removed, keptBecauseWorked: usedIds.size } });
        return NextResponse.json({ removed, kept: usedIds.size });
    } catch (err) {
        return hrFailure(err, 'HR delete shifts');
    }
}

