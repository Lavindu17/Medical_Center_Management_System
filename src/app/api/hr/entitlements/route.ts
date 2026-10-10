import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { parseBody } from '@/lib/validate';
import { requireHr, hrFailure } from '@/lib/hr-auth';
import { HrError, STAFF_ROLES, balances } from '@/lib/hr';

const schema = z.object({
    userId: z.number().int().positive(),
    leaveTypeId: z.number().int().positive(),
    year: z.number().int().min(2000).max(2100),
    // null removes the override, so the person follows the leave type's default again
    days: z.number().min(0).max(366).refine((n) => n * 2 === Math.round(n * 2), 'Days go up in halves').nullable(),
});

/** One person's balances for a year (?userId=&year=). */
export async function GET(req: Request) {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    try {
        const p = new URL(req.url).searchParams;
        const userId = Number(p.get('userId')), year = Number(p.get('year'));
        if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(year)) throw new HrError(400, 'Choose an employee and a year');
        return NextResponse.json({ balances: await balances(userId, year) });
    } catch (err) {
        return hrFailure(err, 'HR balances');
    }
}

/** Set one person's yearly allowance for one leave type (or clear it back to the default). */
export async function PUT(req: Request) {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    const body = await parseBody(req, schema);
    if ('error' in body) return body.error;
    try {
        const { userId, leaveTypeId, year, days } = body.data;
        const who = await query<any[]>(`SELECT id FROM users WHERE id = ? AND role IN (${STAFF_ROLES.map(() => '?').join(',')})`, [userId, ...STAFF_ROLES]);
        if (who.length === 0) throw new HrError(404, 'Employee not found');
        if (days === null) {
            await query('DELETE FROM leave_entitlements WHERE user_id = ? AND leave_type_id = ? AND year = ?', [userId, leaveTypeId, year]);
        } else {
            await query(
                `INSERT INTO leave_entitlements (user_id, leave_type_id, year, days) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE days = VALUES(days)`,
                [userId, leaveTypeId, year, days]);
        }
        await audit(auth.user, { action: 'UPDATE', entity: 'EMPLOYEE', entityId: userId, details: { leaveEntitlement: leaveTypeId, year, days } });
        return NextResponse.json({ balances: await balances(userId, year) });
    } catch (err) {
        return hrFailure(err, 'HR set entitlement');
    }
}
