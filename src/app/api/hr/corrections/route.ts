import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireHr, hrFailure } from '@/lib/hr-auth';

/** Correction requests, newest first. Default: the ones waiting for a decision (?status=ALL for everything). */
export async function GET(req: Request) {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    try {
        const all = new URL(req.url).searchParams.get('status') === 'ALL';
        const rows = await query<any[]>(
            `SELECT c.id, c.user_id AS userId, u.name AS employee, DATE_FORMAT(c.work_date, '%Y-%m-%d') AS workDate, c.record_id AS recordId,
                    TIME_FORMAT(c.requested_in, '%H:%i') AS clockIn, TIME_FORMAT(c.requested_out, '%H:%i') AS clockOut, c.reason, c.status,
                    c.decision_note AS decisionNote, c.created_at AS createdAt
             FROM attendance_corrections c JOIN users u ON u.id = c.user_id
             ${all ? '' : "WHERE c.status = 'PENDING'"} ORDER BY c.created_at DESC LIMIT 200`);
        return NextResponse.json({ corrections: rows });
    } catch (err) {
        return hrFailure(err, 'HR corrections');
    }
}
