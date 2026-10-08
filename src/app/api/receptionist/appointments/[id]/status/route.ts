import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { requireRole } from '@/lib/api-auth';

const schema = z.object({ status: z.enum(['CHECKED_IN', 'CANCELLED', 'ABSENT', 'NO_SHOW']) });

// What the front desk may do, and from which states. (The doctor moves visits to ONGOING / COMPLETED.)
const ALLOWED_FROM: Record<string, string[]> = {
    CHECKED_IN: ['PENDING', 'CONFIRMED'],
    CANCELLED: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'ARRIVED'],
    ABSENT: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'ARRIVED'],
    NO_SHOW: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'ARRIVED'],
};

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
    const auth = await requireRole('RECEPTIONIST', 'ADMIN');
    if ('error' in auth) return auth.error;

    try {
        const id = Number((await props.params).id);
        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ message: 'Invalid appointment id' }, { status: 400 });
        }
        const parsed = schema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ message: 'status must be CHECKED_IN, CANCELLED, ABSENT or NO_SHOW' }, { status: 400 });
        }
        const { status } = parsed.data;

        // Conditional update: the state check and the change are one atomic statement
        const placeholders = ALLOWED_FROM[status].map(() => '?').join(', ');
        const result: any = await query(
            `UPDATE appointments SET status = ? WHERE id = ? AND status IN (${placeholders})`,
            [status, id, ...ALLOWED_FROM[status]]);

        if (result.affectedRows === 1) {
            return NextResponse.json({ message: 'Status User Updated' });
        }

        const current = await query<any[]>('SELECT status FROM appointments WHERE id = ?', [id]);
        if (current.length === 0) return NextResponse.json({ message: 'Appointment not found' }, { status: 404 });
        return NextResponse.json({
            message: `A ${String(current[0].status).toLowerCase().replace('_', ' ')} appointment cannot be marked ${status.toLowerCase().replace('_', ' ')}`,
        }, { status: 409 });
    } catch (error) {
        console.error('Appointment status error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
