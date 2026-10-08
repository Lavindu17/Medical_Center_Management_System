import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { requireRole } from '@/lib/api-auth';

const leaveSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date').refine(
        (d) => { const x = new Date(d + 'T00:00:00Z'); return !Number.isNaN(x.getTime()) && x.toISOString().startsWith(d); },
        'Choose a valid date'),
    reason: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.string().trim().max(255).nullable()),
});

export async function POST(req: Request) {
    const auth = await requireRole('DOCTOR');
    if ('error' in auth) return auth.error;
    const { user } = auth;

    try {
        const parsed = leaveSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ message: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
        }
        const { date, reason } = parsed.data;

        if (date < new Date().toLocaleDateString('en-CA')) {
            return NextResponse.json({ message: 'Leave cannot be set for a past date' }, { status: 400 });
        }

        let id: number;
        try {
            const res: any = await query('INSERT INTO doctor_leaves (doctor_id, date, reason) VALUES (?, ?, ?)', [user.id, date, reason]);
            id = res.insertId;
        } catch (err: any) {
            if (err?.errno === 1062) {
                return NextResponse.json({ message: 'You are already on leave on this date' }, { status: 409 });
            }
            throw err;
        }

        // Bookings already made for that day are not cancelled for the doctor; tell them how many need attention
        const booked = await query<any[]>(
            `SELECT COUNT(*) AS n FROM appointments
             WHERE doctor_id = ? AND date = ? AND status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'ARRIVED')`, [user.id, date]);

        return NextResponse.json({ id, date, reason, doctor_id: user.id, affectedAppointments: Number(booked[0].n) }, { status: 201 });
    } catch (error) {
        console.error('Add leave error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const auth = await requireRole('DOCTOR');
    if ('error' in auth) return auth.error;
    const { user } = auth;

    try {
        const id = Number(new URL(req.url).searchParams.get('id'));
        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ message: 'A valid leave id is required' }, { status: 400 });
        }

        const res: any = await query('DELETE FROM doctor_leaves WHERE id = ? AND doctor_id = ?', [id, user.id]);
        if (res.affectedRows === 0) {
            return NextResponse.json({ message: 'Leave not found' }, { status: 404 });
        }
        return NextResponse.json({ message: 'Deleted' });
    } catch (error) {
        console.error('Delete leave error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
