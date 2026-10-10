import { NextResponse } from 'next/server';
import { requireStaff, hrFailure } from '@/lib/hr-auth';
import { evaluateRange, loadSettings } from '@/lib/hr';
import { summariseDays } from '@/lib/hr-rules';
import { localDay, monthRange } from '@/lib/hr-time';

/** Your attendance for one month (default: this month), a status for every day, and the totals. */
export async function GET(req: Request) {
    const auth = await requireStaff();
    if ('error' in auth) return auth.error;
    try {
        const settings = await loadSettings();
        const month = new URL(req.url).searchParams.get('month') ?? localDay(new Date(), settings.timezone).slice(0, 7);
        const range = monthRange(month);
        if (!range) return NextResponse.json({ message: 'Choose a month like 2026-10' }, { status: 400 });
        const days = (await evaluateRange([auth.user.id], range.from, range.to, settings)).get(auth.user.id)!;
        return NextResponse.json({ timezone: settings.timezone, month, today: localDay(new Date(), settings.timezone), days, summary: summariseDays(days) });
    } catch (err) {
        return hrFailure(err, 'HR my attendance');
    }
}
