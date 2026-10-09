import { NextResponse } from 'next/server';
import { audit, changedFields } from '@/lib/audit';
import { z } from 'zod';
import { query } from '@/lib/db';
import { requireRole } from '@/lib/api-auth';

/** Details every signed-in person can see and edit about themselves, whatever their role. Email is read-only. */
const updateSchema = z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
    phone: z.string().trim().max(20, 'Phone number is too long')
        .regex(/^[0-9+()\-\s]*$/, 'Phone number can only contain digits, spaces, + ( ) and -')
        .optional().or(z.literal('')),
});

export async function GET() {
    const auth = await requireRole();
    if ('error' in auth) return auth.error;

    const rows = await query<any[]>('SELECT name, email, phone, role FROM users WHERE id = ?', [auth.user.id]);
    if (rows.length === 0) return NextResponse.json({ message: 'Account not found' }, { status: 404 });
    return NextResponse.json({ account: rows[0] });
}

export async function PUT(req: Request) {
    const auth = await requireRole();
    if ('error' in auth) return auth.error;

    const parsed = updateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return NextResponse.json({ message: issue.message, field: issue.path[0] }, { status: 400 });
    }

    const { name, phone } = parsed.data;
    await query('UPDATE users SET name = ?, phone = ? WHERE id = ?', [name, phone ? phone : null, auth.user.id]);
    await audit(auth.user, { action: 'UPDATE', entity: 'USER', entityId: auth.user.id, patientId: auth.user.role === 'PATIENT' ? auth.user.id : null, details: { fields: ['name', 'phone'], self: true } });
    return NextResponse.json({ success: true, message: 'Account updated', account: { name, phone: phone || null } });
}
