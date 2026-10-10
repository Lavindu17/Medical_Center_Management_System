import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { toCsvText } from '@/lib/csv';
import { requireHr, hrFailure } from '@/lib/hr-auth';
import { employeesFor, evaluateRange, loadSettings, rangeFrom } from '@/lib/hr';
import { localDay, localTime } from '@/lib/hr-time';

const STATUS: Record<string, string> = {
    PRESENT: 'Present', LATE: 'Late', ABSENT: 'Absent', ON_LEAVE: 'On leave', HOLIDAY: 'Holiday', DAY_OFF: 'Day off', INCOMPLETE: 'Missing clock-out', SCHEDULED: 'Scheduled',
};

/** One row per person per day, in clinic time. The export is recorded in the audit trail. */
export async function GET(req: Request) {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    try {
        const params = new URL(req.url).searchParams;
        const { from, to } = rangeFrom(params, 93);
        const settings = await loadSettings();
        const tz = settings.timezone;
        const people = await employeesFor(params);
        const days = await evaluateRange(people.map((p) => p.id), from, to, settings);

        const rows: unknown[][] = [];
        for (const p of people) {
            for (const d of days.get(p.id)!) {
                if (d.status === 'DAY_OFF' && d.punches.length === 0) continue;
                const first = d.punches[0], last = d.punches[d.punches.length - 1];
                rows.push([
                    d.day, p.employeeNo ?? '', p.name, p.role, p.department ?? '',
                    d.shifts.map((s) => `${s.start}-${s.end}`).join(' / '),
                    first ? `${localDay(new Date(first.clockIn), tz)} ${localTime(new Date(first.clockIn), tz)}` : '',
                    last?.clockOut ? `${localDay(new Date(last.clockOut), tz)} ${localTime(new Date(last.clockOut), tz)}` : '',
                    d.workedMinutes, STATUS[d.status] ?? d.status, d.lateMinutes, d.earlyLeaveMinutes, d.extraMinutes, d.unscheduled ? 'yes' : '',
                    d.leaveType ?? d.holidayName ?? '',
                ]);
            }
        }
        await audit(auth.user, { action: 'EXPORT', entity: 'ATTENDANCE', details: { from, to, people: people.length, rows: rows.length } });
        const csv = toCsvText(['date', 'employee_no', 'name', 'role', 'department', 'shifts', 'first_in', 'last_out', 'worked_minutes', 'status', 'late_minutes', 'early_leave_minutes', 'extra_minutes', 'unscheduled', 'leave_or_holiday'], rows);
        return new NextResponse(csv, {
            headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="attendance-${from}-to-${to}.csv"`, 'Cache-Control': 'private, no-store' },
        });
    } catch (err) {
        return hrFailure(err, 'HR attendance export');
    }
}
