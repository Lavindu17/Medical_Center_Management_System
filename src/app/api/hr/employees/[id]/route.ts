import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { parseBody } from '@/lib/validate';
import { requireHr, hrFailure } from '@/lib/hr-auth';
import { HrError, STAFF_ROLES, balances, loadSettings } from '@/lib/hr';
import { isDay, localDay } from '@/lib/hr-time';

const idOf = async (params: Promise<{ id: string }>) => {
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) throw new HrError(400, 'Invalid employee');
    return id;
};

async function profile(id: number) {
    const [row] = await query<any[]>(
        `SELECT u.id, u.name, u.email, u.phone, u.role, p.employee_no AS employeeNo, p.department, p.designation,
                DATE_FORMAT(p.join_date, '%Y-%m-%d') AS joinDate, COALESCE(p.status, 'ACTIVE') AS status
         FROM users u LEFT JOIN employee_profiles p ON p.user_id = u.id WHERE u.id = ? AND u.role IN (${STAFF_ROLES.map(() => '?').join(',')})`, [id, ...STAFF_ROLES]);
    return row;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    try {
        const id = await idOf(params);
        const row = await profile(id);
        if (!row) throw new HrError(404, 'Employee not found');
        const settings = await loadSettings();
        const year = Number(localDay(new Date(), settings.timezone).slice(0, 4));
        await audit(auth.user, { action: 'VIEW', entity: 'EMPLOYEE', entityId: id });
        return NextResponse.json({ employee: row, balances: await balances(id, year), year });
    } catch (err) {
        return hrFailure(err, 'HR employee');
    }
}

const text = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null);
const schema = z.object({
    employeeNo: text(30),
    department: text(80),
    designation: text(80),
    joinDate: z.string().refine(isDay, 'Enter a valid join date').nullish().transform((v) => v || null),
    status: z.enum(['ACTIVE', 'INACTIVE']),
});

/** HR edits an employee's profile (employee number, department, designation, join date, active or not). */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    const body = await parseBody(req, schema);
    if ('error' in body) return body.error;
    try {
        const id = await idOf(params);
        if (!(await profile(id))) throw new HrError(404, 'Employee not found');
        const { employeeNo, department, designation, joinDate, status } = body.data;
        try {
            await query(
                `INSERT INTO employee_profiles (user_id, employee_no, department, designation, join_date, status) VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE employee_no = VALUES(employee_no), department = VALUES(department), designation = VALUES(designation), join_date = VALUES(join_date), status = VALUES(status)`,
                [id, employeeNo, department, designation, joinDate, status]);
        } catch (err: any) {
            if (err?.errno === 1062) throw new HrError(409, 'That employee number is already used');
            throw err;
        }
        await audit(auth.user, { action: 'UPDATE', entity: 'EMPLOYEE', entityId: id, details: { fields: ['employee_no', 'department', 'designation', 'join_date', 'status'], status } });
        return NextResponse.json({ employee: await profile(id) });
    } catch (err) {
        return hrFailure(err, 'HR update employee');
    }
}
