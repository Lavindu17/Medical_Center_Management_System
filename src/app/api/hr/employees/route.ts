import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { requireHr, hrFailure } from '@/lib/hr-auth';
import { STAFF_ROLES, evaluateRange, loadSettings } from '@/lib/hr';
import { localDay } from '@/lib/hr-time';

/** All staff with their HR profile and what they are doing today. */
export async function GET(req: Request) {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    try {
        const params = new URL(req.url).searchParams;
        const q = (params.get('q') ?? '').trim().slice(0, 80);
        const role = params.get('role');
        const includeInactive = params.get('inactive') === '1';
        const where: string[] = [`u.role IN (${STAFF_ROLES.map(() => '?').join(',')})`];
        const args: any[] = [...STAFF_ROLES];
        if (q) { where.push('(u.name LIKE ? OR u.email LIKE ? OR p.employee_no LIKE ? OR p.department LIKE ?)'); args.push(...Array(4).fill(`%${q.replace(/[%_\\]/g, '\\$&')}%`)); }
        if (role && (STAFF_ROLES as readonly string[]).includes(role)) { where.push('u.role = ?'); args.push(role); }
        if (!includeInactive) where.push("COALESCE(p.status, 'ACTIVE') = 'ACTIVE'");

        const rows = await query<any[]>(
            `SELECT u.id, u.name, u.email, u.phone, u.role, p.employee_no AS employeeNo, p.department, p.designation,
                    DATE_FORMAT(p.join_date, '%Y-%m-%d') AS joinDate, COALESCE(p.status, 'ACTIVE') AS status
             FROM users u LEFT JOIN employee_profiles p ON p.user_id = u.id
             WHERE ${where.join(' AND ')} ORDER BY u.name LIMIT 500`, args);

        const settings = await loadSettings();
        const today = localDay(new Date(), settings.timezone);
        const days = await evaluateRange(rows.map((r) => r.id), today, today, settings);
        const employees = rows.map((r) => ({ ...r, today: days.get(r.id)?.[0] ?? null }));

        await audit(auth.user, { action: 'SEARCH', entity: 'EMPLOYEE', details: { term: Boolean(q), results: employees.length } });
        return NextResponse.json({ timezone: settings.timezone, today, employees });
    } catch (err) {
        return hrFailure(err, 'HR employees');
    }
}
