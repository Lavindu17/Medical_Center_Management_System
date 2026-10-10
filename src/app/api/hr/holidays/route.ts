import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { parseBody } from '@/lib/validate';
import { requireHr, hrFailure } from '@/lib/hr-auth';
import { HrError, loadHolidays } from '@/lib/hr';
import { isDay } from '@/lib/hr-time';

const schema = z.object({
    date: z.string().refine(isDay, 'Choose a valid date'),
    name: z.string().trim().min(2, 'Give the holiday a name').max(100),
});

/** Public holidays for a year (?year=). Holidays are not charged as leave and are not absences. */
export async function GET(req: Request) {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    try {
        const year = Number(new URL(req.url).searchParams.get('year')) || new Date().getFullYear();
        const map = await loadHolidays(`${year}-01-01`, `${year}-12-31`);
        return NextResponse.json({ year, holidays: [...map].map(([date, name]) => ({ date, name })) });
    } catch (err) {
        return hrFailure(err, 'HR holidays');
    }
}

/** Add a holiday, or rename one on the same date. */
export async function POST(req: Request) {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    const body = await parseBody(req, schema);
    if ('error' in body) return body.error;
    try {
        await query('INSERT INTO public_holidays (holiday_date, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)', [body.data.date, body.data.name]);
        await audit(auth.user, { action: 'CREATE', entity: 'HOLIDAY', entityId: body.data.date, details: { name: body.data.name } });
        return NextResponse.json({ message: 'Holiday saved' }, { status: 201 });
    } catch (err) {
        return hrFailure(err, 'HR add holiday');
    }
}

export async function DELETE(req: Request) {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    try {
        const date = new URL(req.url).searchParams.get('date') ?? '';
        if (!isDay(date)) throw new HrError(400, 'Choose a valid date');
        await query('DELETE FROM public_holidays WHERE holiday_date = ?', [date]);
        await audit(auth.user, { action: 'DELETE', entity: 'HOLIDAY', entityId: date });
        return NextResponse.json({ message: 'Holiday removed' });
    } catch (err) {
        return hrFailure(err, 'HR delete holiday');
    }
}
