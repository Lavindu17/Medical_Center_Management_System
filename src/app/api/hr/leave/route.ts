import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireHr, hrFailure } from '@/lib/hr-auth';
import { balances, loadLeave } from '@/lib/hr';
import { bookedAppointments } from '@/lib/doctor-leave';
import { eachDay } from '@/lib/hr-time';

/**
 * Leave requests for HR. Each pending request comes with what a decision needs: the person's remaining balance, who else is
 * off on those days, and (for doctors) how many booked appointments fall on them.
 */
export async function GET(req: Request) {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    try {
        const params = new URL(req.url).searchParams;
        const status = (params.get('status') ?? 'PENDING').toUpperCase();
        const filter = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(status) ? [status] : [];
        const userId = Number(params.get('userId'));

        const where: string[] = [];
        const args: any[] = [];
        if (filter.length) { where.push('r.status = ?'); args.push(filter[0]); }
        if (Number.isInteger(userId) && userId > 0) { where.push('r.user_id = ?'); args.push(userId); }

        const rows = await query<any[]>(
            `SELECT r.id, r.user_id AS userId, u.name AS employee, u.role, p.department, r.leave_type_id AS leaveTypeId, t.name AS typeName, t.paid,
                    DATE_FORMAT(r.start_date, '%Y-%m-%d') AS start, DATE_FORMAT(r.end_date, '%Y-%m-%d') AS end, r.day_part AS dayPart, r.days, r.reason, r.status,
                    r.decision_note AS decisionNote, d.name AS decidedByName, r.created_at AS createdAt
             FROM leave_requests r JOIN users u ON u.id = r.user_id JOIN leave_types t ON t.id = r.leave_type_id
             LEFT JOIN employee_profiles p ON p.user_id = r.user_id LEFT JOIN users d ON d.id = r.decided_by
             ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
             ORDER BY (r.status = 'PENDING') DESC, r.start_date DESC LIMIT 200`, args);

        const requests = [];
        for (const r of rows) {
            const extra: Record<string, unknown> = {};
            if (r.status === 'PENDING') {
                const year = Number(r.start.slice(0, 4));
                const bal = (await balances(r.userId, year)).find((b) => b.typeId === r.leaveTypeId);
                extra.balanceRemaining = bal ? (bal.unlimited ? null : bal.remaining + Number(r.days)) : null;   // before this request
                const others = (await loadLeave(null, r.start, r.end, ['APPROVED'])).filter((l) => l.user_id !== r.userId);
                const names = await query<{ id: number; name: string }[]>(`SELECT id, name FROM users WHERE id IN (${[...new Set(others.map((o) => o.user_id))].map(() => '?').join(',') || 'NULL'})`, [...new Set(others.map((o) => o.user_id))]);
                extra.othersOff = names.slice(0, 6).map((n) => n.name);
                extra.othersOffCount = names.length;
                if (r.role === 'DOCTOR') extra.bookedAppointments = await bookedAppointments(r.userId, eachDay(r.start, r.end));
            }
            requests.push({ ...r, ...extra });
        }
        return NextResponse.json({ requests });
    } catch (err) {
        return hrFailure(err, 'HR leave list');
    }
}
