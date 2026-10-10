import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { requireHr, hrFailure } from '@/lib/hr-auth';
import { employeesFor, evaluateRange, loadSettings, rangeFrom } from '@/lib/hr';
import { summariseDays } from '@/lib/hr-rules';
import { localDay } from '@/lib/hr-time';

/** Attendance for a date range: a status for every person and day, with totals per person. */
export async function GET(req: Request) {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    try {
        const params = new URL(req.url).searchParams;
        const { from, to } = rangeFrom(params);
        const settings = await loadSettings();
        const people = await employeesFor(params);
        const days = await evaluateRange(people.map((p) => p.id), from, to, settings);
        const employees = people.map((p) => ({ ...p, days: days.get(p.id)!, summary: summariseDays(days.get(p.id)!) }));
        await audit(auth.user, { action: 'VIEW', entity: 'ATTENDANCE', entityId: Number(params.get('userId')) || null, details: { from, to, people: employees.length } });
        return NextResponse.json({ timezone: settings.timezone, today: localDay(new Date(), settings.timezone), from, to, employees });
    } catch (err) {
        return hrFailure(err, 'HR attendance');
    }
}
