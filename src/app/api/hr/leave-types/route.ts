import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { parseBody } from '@/lib/validate';
import { requireHr, hrFailure } from '@/lib/hr-auth';
import { HrError, leaveTypes } from '@/lib/hr';

const schema = z.object({
    id: z.number().int().positive().optional(),
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,20}$/, 'Code: 2 to 20 letters, digits or underscores'),
    name: z.string().trim().min(2, 'Give the leave type a name').max(60),
    daysPerYear: z.number().min(0).max(366).refine((n) => n * 2 === Math.round(n * 2), 'Days go up in halves'),
    paid: z.boolean(),
    allowsHalfDay: z.boolean(),
    unlimited: z.boolean(),
    active: z.boolean(),
    sortOrder: z.number().int().min(0).max(999).default(0),
});

export async function GET() {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    try {
        return NextResponse.json({ types: await leaveTypes(false) });
    } catch (err) {
        return hrFailure(err, 'HR leave types');
    }
}

/** Create a leave type, or change one (send its id). Types are never deleted, only switched off, so history keeps its meaning. */
export async function POST(req: Request) {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    const body = await parseBody(req, schema);
    if ('error' in body) return body.error;
    try {
        const t = body.data;
        try {
            if (t.id) {
                const res: any = await query(
                    `UPDATE leave_types SET code = ?, name = ?, days_per_year = ?, paid = ?, allows_half_day = ?, unlimited = ?, active = ?, sort_order = ? WHERE id = ?`,
                    [t.code, t.name, t.daysPerYear, +t.paid, +t.allowsHalfDay, +t.unlimited, +t.active, t.sortOrder, t.id]);
                if (res.affectedRows === 0) throw new HrError(404, 'Leave type not found');
            } else {
                await query(
                    `INSERT INTO leave_types (code, name, days_per_year, paid, allows_half_day, unlimited, active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [t.code, t.name, t.daysPerYear, +t.paid, +t.allowsHalfDay, +t.unlimited, +t.active, t.sortOrder]);
            }
        } catch (err: any) {
            if (err?.errno === 1062) throw new HrError(409, 'A leave type with that code already exists');
            throw err;
        }
        await audit(auth.user, { action: t.id ? 'UPDATE' : 'CREATE', entity: 'LEAVE_TYPE', entityId: t.id ?? null, details: { code: t.code, daysPerYear: t.daysPerYear, active: t.active } });
        return NextResponse.json({ types: await leaveTypes(false) }, { status: t.id ? 200 : 201 });
    } catch (err) {
        return hrFailure(err, 'HR save leave type');
    }
}
