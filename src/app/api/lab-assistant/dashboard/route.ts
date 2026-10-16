import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { loadSettings } from '@/lib/hr';
import { addDays, localDay } from '@/lib/hr-time';
import { dayLabel, recentDays } from '@/lib/dashboard-range';

/** Workload for the lab: what is waiting, what was finished today, how long tests take, and a 14-day requested/completed trend. */
export async function GET() {
    const auth = await requirePermission('lab.dashboard', 'view');
    if ('error' in auth) return auth.error;

    try {
        const today = localDay(new Date(), (await loadSettings()).timezone);
        const days = recentDays(today, 14);
        const live = `a.status <> 'CANCELLED'`;

        const [pending, doneToday, turnaround, requested, completed, oldest] = await Promise.all([
            query<any[]>(`SELECT COUNT(*) AS n FROM lab_requests lr JOIN appointments a ON a.id = lr.appointment_id WHERE lr.status = 'PENDING' AND ${live}`),
            query<any[]>(`SELECT COUNT(*) AS n FROM lab_requests WHERE status = 'COMPLETED' AND DATE_FORMAT(completed_at, '%Y-%m-%d') = ?`, [today]),
            query<any[]>(
                `SELECT AVG(TIMESTAMPDIFF(MINUTE, requested_at, completed_at)) AS minutes FROM lab_requests
                 WHERE status = 'COMPLETED' AND completed_at IS NOT NULL AND DATE_FORMAT(completed_at, '%Y-%m-%d') >= ?`, [addDays(today, -29)]),
            query<any[]>(
                `SELECT DATE_FORMAT(lr.requested_at, '%Y-%m-%d') AS day, COUNT(*) AS requested FROM lab_requests lr JOIN appointments a ON a.id = lr.appointment_id
                 WHERE ${live} AND DATE_FORMAT(lr.requested_at, '%Y-%m-%d') >= ? GROUP BY day`, [days[0]]),
            query<any[]>(
                `SELECT DATE_FORMAT(completed_at, '%Y-%m-%d') AS day, COUNT(*) AS completed FROM lab_requests
                 WHERE status = 'COMPLETED' AND DATE_FORMAT(completed_at, '%Y-%m-%d') >= ? GROUP BY day`, [days[0]]),
            query<any[]>(
                `SELECT lr.id, lt.name AS test, p.name AS patient, TIMESTAMPDIFF(MINUTE, lr.requested_at, NOW()) AS waiting_minutes
                 FROM lab_requests lr JOIN lab_tests lt ON lt.id = lr.test_id JOIN appointments a ON a.id = lr.appointment_id JOIN users p ON p.id = a.patient_id
                 WHERE lr.status = 'PENDING' AND ${live} ORDER BY lr.requested_at LIMIT 5`),
        ]);

        const merged = days.map((day) => ({
            day, label: dayLabel(day),
            requested: Number(requested.find((r) => r.day === day)?.requested ?? 0),
            completed: Number(completed.find((r) => r.day === day)?.completed ?? 0),
        }));
        const minutes = turnaround[0].minutes;
        return NextResponse.json({
            today,
            pending: Number(pending[0].n),
            completedToday: Number(doneToday[0].n),
            avgTurnaroundMinutes: minutes === null || minutes === undefined ? null : Math.round(Number(minutes)),
            oldestPending: oldest.map((r) => ({ id: r.id, test: r.test, patient: r.patient, waitingMinutes: Math.max(0, Number(r.waiting_minutes)) })),
            trend: merged,
        });
    } catch (error) {
        console.error('Lab dashboard error:', error);
        return NextResponse.json({ message: 'Could not load the dashboard' }, { status: 500 });
    }
}
