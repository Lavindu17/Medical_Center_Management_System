import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { parseBody } from '@/lib/validate';
import { requireRole } from '@/lib/api-auth';
import { notify } from '@/lib/notify';
import { blockDoctorDay } from '@/lib/doctor-leave';
import { bookingsOn, dateSchema } from '@/lib/doctor-schedule';
import { loadSettings } from '@/lib/hr';
import { eachDay, localDay } from '@/lib/hr-time';

const MAX_DAYS = 366;

const schema = z.object({
    from: dateSchema,
    to: dateSchema.nullish(),
    reason: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.string().trim().max(255).nullable()),
    dryRun: z.boolean().optional(),
});

/**
 * Block a doctor for a day or a range of days. With dryRun the response only reports what would happen
 * (days to block, days already blocked, bookings affected) so the admin sees the impact before saving.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole('ADMIN');
    if ('error' in auth) return auth.error;
    const body = await parseBody(req, schema);
    if ('error' in body) return body.error;
    try {
        const id = Number((await params).id);
        if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ message: 'Invalid doctor' }, { status: 400 });
        const [doctor] = await query<any[]>(`SELECT user_id FROM doctors WHERE user_id = ?`, [id]);
        if (!doctor) return NextResponse.json({ message: 'Doctor not found' }, { status: 404 });

        const { from, reason, dryRun } = body.data;
        const to = body.data.to || from;
        if (to < from) return NextResponse.json({ message: 'The last day cannot be before the first day' }, { status: 400 });
        const today = localDay(new Date(), (await loadSettings()).timezone);
        if (from < today) return NextResponse.json({ message: 'Time off cannot start in the past' }, { status: 400 });
        const days = eachDay(from, to);
        if (days.length > MAX_DAYS || days[days.length - 1] !== to) return NextResponse.json({ message: `Choose at most ${MAX_DAYS} days at a time` }, { status: 400 });

        const existing = await query<any[]>(
            `SELECT DATE_FORMAT(date, '%Y-%m-%d') AS d FROM doctor_leaves WHERE doctor_id = ? AND date BETWEEN ? AND ?`, [id, from, to]);
        const already = new Set(existing.map((r) => r.d));
        const toBlock = days.filter((d) => !already.has(d));
        const booked = await bookingsOn(id, toBlock);
        const affectedAppointments = Object.values(booked).reduce((a, b) => a + b, 0);

        if (dryRun) {
            return NextResponse.json({ days: toBlock.length, alreadyBlocked: already.size, affectedAppointments, bookedDays: Object.keys(booked) });
        }
        if (toBlock.length === 0) return NextResponse.json({ message: 'The doctor is already off on every one of those days' }, { status: 409 });

        let blocked = 0;
        for (const day of toBlock) {
            const r = await blockDoctorDay(id, day, reason);
            if (!r.alreadyOnLeave) blocked++;
        }
        await audit(auth.user, { action: 'CREATE', entity: 'DOCTOR_LEAVE', entityId: id, details: { from, to, days: blocked, affectedAppointments } });
        await notify(null, id, {
            type: 'SCHEDULE_CHANGED', title: 'Time off added to your schedule',
            body: from === to ? `The administrator blocked ${from} in your schedule.` : `The administrator blocked ${from} to ${to} in your schedule.`, link: '/doctor/profile',
        });
        return NextResponse.json({ days: blocked, alreadyBlocked: already.size, affectedAppointments }, { status: 201 });
    } catch (error) {
        console.error('Admin doctor leave POST error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}

/** Remove one blocked day. Days that came from approved HR leave are removed by cancelling that leave instead. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole('ADMIN');
    if ('error' in auth) return auth.error;
    try {
        const doctorId = Number((await params).id);
        const id = Number(new URL(req.url).searchParams.get('id'));
        if (!Number.isInteger(doctorId) || doctorId <= 0 || !Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ message: 'A valid leave id is required' }, { status: 400 });
        }
        const [row] = await query<any[]>(`SELECT * FROM doctor_leaves WHERE id = ? AND doctor_id = ?`, [id, doctorId]);
        if (!row) return NextResponse.json({ message: 'Leave not found' }, { status: 404 });
        if (row.leave_request_id) {
            return NextResponse.json({ message: 'This day comes from approved HR leave. Cancel that leave in the HR portal instead.' }, { status: 409 });
        }
        await query('DELETE FROM doctor_leaves WHERE id = ? AND doctor_id = ?', [id, doctorId]);
        await audit(auth.user, { action: 'DELETE', entity: 'DOCTOR_LEAVE', entityId: id });
        return NextResponse.json({ message: 'Deleted' });
    } catch (error) {
        console.error('Admin doctor leave DELETE error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
