import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireRole } from '@/lib/api-auth';
import { verifyChain } from '@/lib/audit';
import { loadSettings } from '@/lib/hr';
import { addDays, localDay } from '@/lib/hr-time';
import { dayLabel, fillDays, monthComparison, pctChange, recentDays } from '@/lib/dashboard-range';

/** Walking the whole audit chain is only done on every dashboard load while it is small */
const CHAIN_CHECK_LIMIT = 20_000;

/** A count from a table that may not exist yet (HR tables before 20_hr.sql): zero instead of an error. */
async function countOrZero(sql: string, params: any[] = []): Promise<number> {
    try {
        return Number((await query<any[]>(sql, params))[0].n);
    } catch (err: any) {
        if (err?.errno === 1146 || err?.errno === 1054) return 0;
        throw err;
    }
}

/** Everything the admin overview shows, in one call. Operations first; money is this month against last. */
export async function GET() {
    const auth = await requireRole('ADMIN');
    if ('error' in auth) return auth.error;

    try {
        const today = localDay(new Date(), (await loadSettings()).timezone);
        const days = recentDays(today, 14);
        const month = monthComparison(today);
        const since30 = addDays(today, -29);

        const [patients, staff, perDay, statusToday, topDoctors, paid, lowStock, expiring, pendingLeave, pendingCorrections, onLeaveToday, auditCount] = await Promise.all([
            query<any[]>(`SELECT COUNT(*) AS n FROM users WHERE role = 'PATIENT'`),
            query<any[]>(`SELECT COUNT(*) AS n FROM users WHERE role <> 'PATIENT'`),
            query<any[]>(
                `SELECT DATE_FORMAT(date, '%Y-%m-%d') AS day, SUM(status <> 'CANCELLED') AS booked, SUM(status = 'COMPLETED') AS completed
                 FROM appointments WHERE date BETWEEN ? AND ? GROUP BY date`, [days[0], today]),
            query<any[]>(`SELECT status, COUNT(*) AS n FROM appointments WHERE date = ? GROUP BY status`, [today]),
            query<any[]>(
                `SELECT u.name, COUNT(*) AS n FROM appointments a JOIN users u ON u.id = a.doctor_id
                 WHERE a.date BETWEEN ? AND ? AND a.status <> 'CANCELLED' GROUP BY a.doctor_id, u.name ORDER BY n DESC, u.name LIMIT 5`, [since30, today]),
            query<any[]>(
                `SELECT SUM((DATE_FORMAT(paid_at, '%Y-%m-%d') BETWEEN ? AND ?) * total_amount) AS this_month, SUM((DATE_FORMAT(paid_at, '%Y-%m-%d') BETWEEN ? AND ?) * total_amount) AS last_month
                 FROM bills WHERE status = 'PAID' AND paid_at IS NOT NULL`, [month.thisFrom, month.thisTo, month.lastFrom, month.lastTo]),
            query<any[]>(`SELECT COUNT(*) AS n FROM medicines WHERE stock < COALESCE(min_stock_level, 20)`),
            query<any[]>(`SELECT COUNT(*) AS n FROM inventory_batches WHERE quantity_current > 0 AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)`),
            countOrZero(`SELECT COUNT(*) AS n FROM leave_requests WHERE status = 'PENDING'`).then((n) => [{ n }]),
            countOrZero(`SELECT COUNT(*) AS n FROM attendance_corrections WHERE status = 'PENDING'`).then((n) => [{ n }]),
            query<any[]>(`SELECT COUNT(*) AS n FROM doctor_leaves WHERE date = ?`, [today]),
            query<any[]>(`SELECT COUNT(*) AS n FROM audit_log`).catch(() => [{ n: -1 }]),
        ]);

        const series = fillDays<{ booked: number; completed: number }>(days, perDay, ['booked', 'completed'])
            .map((d) => ({ ...d, label: dayLabel(d.day) }));
        const todayRow = series[series.length - 1];

        let audit: { status: 'ok' | 'broken' | 'skipped' | 'unavailable'; checked?: number } = { status: 'unavailable' };
        const rows = Number(auditCount[0].n);
        if (rows >= 0) {
            if (rows > CHAIN_CHECK_LIMIT) audit = { status: 'skipped', checked: rows };
            else {
                const report = await verifyChain();
                audit = { status: report.ok ? 'ok' : 'broken', checked: report.checked };
            }
        }

        const thisMonth = Number(paid[0].this_month ?? 0);
        const lastMonth = Number(paid[0].last_month ?? 0);
        return NextResponse.json({
            today,
            patients: Number(patients[0].n),
            staff: Number(staff[0].n),
            todayAppointments: todayRow.booked,
            todayStatus: statusToday.map((r) => ({ name: r.status as string, value: Number(r.n) })),
            appointments: series,
            topDoctors: topDoctors.map((r) => ({ name: r.name as string, value: Number(r.n) })),
            revenue: { thisMonth, lastMonth, change: pctChange(thisMonth, lastMonth) },
            attention: {
                pendingLeave: pendingLeave[0].n,
                pendingCorrections: pendingCorrections[0].n,
                lowStock: Number(lowStock[0].n),
                expiringBatches: Number(expiring[0].n),
                doctorsOnLeave: Number(onLeaveToday[0].n),
            },
            health: { database: 'ok', audit },
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        return NextResponse.json({ message: 'Could not load the dashboard' }, { status: 500 });
    }
}
