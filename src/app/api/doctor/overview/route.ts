import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireRole } from '@/lib/api-auth';
import { loadSettings } from '@/lib/hr';
import { addDays, localDay } from '@/lib/hr-time';
import { dayLabel, daysAround } from '@/lib/dashboard-range';

/**
 * The doctor's dashboard beyond the headline numbers: today's queue (who is in, who is waiting, who is next),
 * a past-and-upcoming appointment chart with the fee earned on paid bills, and how the last 30 days went.
 */
export async function GET() {
    const auth = await requireRole('DOCTOR');
    if ('error' in auth) return auth.error;
    const { user } = auth;

    try {
        const today = localDay(new Date(), (await loadSettings()).timezone);
        const days = daysAround(today, 7, 7);

        const [perDay, todayRows, outcome] = await Promise.all([
            query<any[]>(
                `SELECT DATE_FORMAT(a.date, '%Y-%m-%d') AS day, COUNT(*) AS appointments,
                        COALESCE(SUM(CASE WHEN a.status = 'COMPLETED' AND b.status = 'PAID' THEN b.doctor_fee ELSE 0 END), 0) AS revenue
                 FROM appointments a LEFT JOIN bills b ON b.appointment_id = a.id
                 WHERE a.doctor_id = ? AND a.date BETWEEN ? AND ? AND a.status <> 'CANCELLED' GROUP BY a.date`, [user.id, days[0], days[days.length - 1]]),
            query<any[]>(
                `SELECT a.id, a.queue_number, TIME_FORMAT(a.time_slot, '%H:%i') AS time_slot, a.status, p.name AS patient
                 FROM appointments a LEFT JOIN users p ON p.id = a.patient_id
                 WHERE a.doctor_id = ? AND a.date = ? AND a.status <> 'CANCELLED' ORDER BY a.queue_number, a.time_slot`, [user.id, today]),
            query<any[]>(
                `SELECT status, COUNT(*) AS n FROM appointments WHERE doctor_id = ? AND date BETWEEN ? AND ? GROUP BY status`, [user.id, addDays(today, -30), addDays(today, -1)]),
        ]);

        const series = days.map((day) => {
            const row = perDay.find((r) => r.day === day);
            return { day, label: dayLabel(day), appointments: Number(row?.appointments ?? 0), revenue: Number(row?.revenue ?? 0), upcoming: day > today };
        });

        const entry = (r: any) => ({ id: r.id, queue: r.queue_number, time: r.time_slot, patient: r.patient ?? 'Unknown patient', status: r.status });
        const now = todayRows.find((r) => r.status === 'ONGOING');
        const waiting = todayRows.filter((r) => r.status === 'CHECKED_IN' || r.status === 'ARRIVED');
        const later = todayRows.filter((r) => r.status === 'PENDING' || r.status === 'CONFIRMED');

        const n = (...s: string[]) => outcome.filter((r) => s.includes(r.status)).reduce((t, r) => t + Number(r.n), 0);
        const completed = n('COMPLETED'), missed = n('ABSENT', 'NO_SHOW', 'PENDING'), cancelled = n('CANCELLED');
        return NextResponse.json({
            today,
            series,
            queue: { now: now ? entry(now) : null, waiting: waiting.map(entry), later: later.map(entry), seen: todayRows.filter((r) => r.status === 'COMPLETED').length, total: todayRows.length },
            lastThirtyDays: { completed, missed, cancelled, completionRate: completed + missed > 0 ? Math.round((completed / (completed + missed)) * 100) : null },
        });
    } catch (error) {
        console.error('Doctor overview error:', error);
        return NextResponse.json({ message: 'Could not load the dashboard' }, { status: 500 });
    }
}
