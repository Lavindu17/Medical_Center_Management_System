import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireHr, hrFailure } from '@/lib/hr-auth';
import { employeesFor, evaluateRange, loadSettings } from '@/lib/hr';
import { addDays, localDay } from '@/lib/hr-time';
import { dayLabel } from '@/lib/dashboard-range';

/** The HR landing page: where everyone is today, and what is waiting for a decision. */
export async function GET() {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    try {
        const settings = await loadSettings();
        const today = localDay(new Date(), settings.timezone);
        const people = await employeesFor(new URLSearchParams());
        const days = await evaluateRange(people.map((p) => p.id), today, today, settings);

        const counts = { staff: people.length, working: 0, late: 0, absent: 0, onLeave: 0, scheduled: 0, dayOff: 0, holiday: 0, missingClockOut: 0 };
        const list = people.map((p) => {
            const d = days.get(p.id)![0];
            const openNow = d.punches.some((x) => !x.clockOut);
            if (d.status === 'PRESENT' || d.status === 'LATE') counts.working++;
            if (d.status === 'LATE') counts.late++;
            if (d.status === 'ABSENT') counts.absent++;
            if (d.status === 'ON_LEAVE') counts.onLeave++;
            if (d.status === 'SCHEDULED') counts.scheduled++;
            if (d.status === 'DAY_OFF') counts.dayOff++;
            if (d.status === 'HOLIDAY') counts.holiday++;
            return { id: p.id, name: p.name, role: p.role, department: p.department, status: d.status, openNow, lateMinutes: d.lateMinutes, shifts: d.shifts };
        });

        // Sessions left open past the limit in the last 14 days, and the daily attendance mix for the trend chart
        const recent = await evaluateRange(people.map((p) => p.id), addDays(today, -14), today, settings);
        const trend = new Map<string, { day: string; label: string; onTime: number; late: number; absent: number; onLeave: number }>();
        for (const arr of recent.values()) {
            for (const d of arr) {
                if (d.day === today) continue;
                if (d.status === 'INCOMPLETE') counts.missingClockOut++;
                if (d.day < addDays(today, -14)) continue;
                const row = trend.get(d.day) ?? { day: d.day, label: dayLabel(d.day), onTime: 0, late: 0, absent: 0, onLeave: 0 };
                if (d.status === 'PRESENT') row.onTime++;
                else if (d.status === 'LATE') row.late++;
                else if (d.status === 'ABSENT') row.absent++;
                else if (d.status === 'ON_LEAVE') row.onLeave++;
                trend.set(d.day, row);
            }
        }

        const [pendingLeave] = await query<{ n: number }[]>("SELECT COUNT(*) AS n FROM leave_requests WHERE status = 'PENDING'");
        const [pendingCorrections] = await query<{ n: number }[]>("SELECT COUNT(*) AS n FROM attendance_corrections WHERE status = 'PENDING'");
        return NextResponse.json({
            today, timezone: settings.timezone, counts, people: list,
            trend: [...trend.values()].sort((a, b) => a.day.localeCompare(b.day)),
            pendingLeave: Number(pendingLeave.n), pendingCorrections: Number(pendingCorrections.n),
        });
    } catch (err) {
        return hrFailure(err, 'HR overview');
    }
}
