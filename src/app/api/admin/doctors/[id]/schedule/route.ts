import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { parseBody } from '@/lib/validate';
import { requirePermission } from '@/lib/api-auth';
import { notify } from '@/lib/notify';
import { findOverlap, saveSchedule, scheduleSchema } from '@/lib/doctor-schedule';
import { loadSettings } from '@/lib/hr';
import { localDay } from '@/lib/hr-time';

async function doctorId(params: Promise<{ id: string }>): Promise<number | null> {
    const id = Number((await params).id);
    return Number.isInteger(id) && id > 0 ? id : null;
}

/** One doctor's weekly hours, slot length and upcoming time off (admin only). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requirePermission('admin.doctors', 'view');
    if ('error' in auth) return auth.error;
    try {
        const id = await doctorId(params);
        if (!id) return NextResponse.json({ message: 'Invalid doctor' }, { status: 400 });
        const [doctor] = await query<any[]>(
            `SELECT u.id, u.name, d.specialization, d.slot_duration AS slotDuration FROM users u JOIN doctors d ON d.user_id = u.id WHERE u.id = ? AND u.role = 'DOCTOR'`, [id]);
        if (!doctor) return NextResponse.json({ message: 'Doctor not found' }, { status: 404 });

        const sessions = await query<any[]>(
            `SELECT day, TIME_FORMAT(start_time, '%H:%i') AS start, TIME_FORMAT(end_time, '%H:%i') AS end FROM doctor_schedules
             WHERE doctor_id = ? AND is_active = 1 ORDER BY start_time`, [id]);
        const today = localDay(new Date(), (await loadSettings()).timezone);
        let leaves: any[];
        try {
            leaves = await query<any[]>(
                `SELECT l.id, DATE_FORMAT(l.date, '%Y-%m-%d') AS date, l.reason, (l.leave_request_id IS NOT NULL) AS fromHr,
                        (SELECT COUNT(*) FROM appointments a WHERE a.doctor_id = l.doctor_id AND a.date = l.date
                           AND a.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'ARRIVED')) AS booked
                 FROM doctor_leaves l WHERE l.doctor_id = ? AND l.date >= ? ORDER BY l.date`, [id, today]);
        } catch (err: any) {
            if (err?.errno !== 1054) throw err;   // leave_request_id not migrated yet
            leaves = await query<any[]>(
                `SELECT l.id, DATE_FORMAT(l.date, '%Y-%m-%d') AS date, l.reason, 0 AS fromHr, 0 AS booked FROM doctor_leaves l WHERE l.doctor_id = ? AND l.date >= ? ORDER BY l.date`, [id, today]);
        }
        return NextResponse.json({
            doctor: { id: doctor.id, name: doctor.name, specialization: doctor.specialization },
            slotDuration: Number(doctor.slotDuration) || 15,
            sessions,
            leaves: leaves.map((l) => ({ ...l, fromHr: Boolean(Number(l.fromHr)), booked: Number(l.booked) })),
            today,
        });
    } catch (error) {
        console.error('Admin doctor schedule GET error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}

/** Replace a doctor's weekly hours and slot length. Bookings already made are kept; the response says how many no longer fit. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requirePermission('admin.doctors', 'change');
    if ('error' in auth) return auth.error;
    const body = await parseBody(req, scheduleSchema);
    if ('error' in body) return body.error;
    try {
        const id = await doctorId(params);
        if (!id) return NextResponse.json({ message: 'Invalid doctor' }, { status: 400 });
        const overlap = findOverlap(body.data.sessions);
        if (overlap) return NextResponse.json({ message: overlap }, { status: 400 });

        const result = await saveSchedule(id, body.data);
        if (!result) return NextResponse.json({ message: 'Doctor not found' }, { status: 404 });

        await audit(auth.user, { action: 'UPDATE', entity: 'DOCTOR_PROFILE', entityId: id, details: { sessions: body.data.sessions.length, slotDuration: body.data.slotDuration } });
        await notify(null, id, {
            type: 'SCHEDULE_CHANGED', title: 'Your working hours were updated',
            body: 'The administrator changed your weekly working hours. See Practice Profile for the new times.', link: '/doctor/profile',
        });
        return NextResponse.json({ message: 'Updated', outsideSchedule: result.outsideSchedule });
    } catch (error) {
        console.error('Admin doctor schedule PUT error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
