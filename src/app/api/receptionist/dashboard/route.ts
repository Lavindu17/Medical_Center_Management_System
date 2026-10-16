import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { loadSettings } from '@/lib/hr';
import { localDay } from '@/lib/hr-time';

/** Today at the front desk: counts, each doctor's live queue, bookings per hour and the bills still to collect. */
export async function GET() {
    const auth = await requirePermission('reception.dashboard', 'view');
    if ('error' in auth) return auth.error;

    try {
        const today = localDay(new Date(), (await loadSettings()).timezone);
        const [appointments, bills, oldestBills] = await Promise.all([
            query<any[]>(
                `SELECT a.id, a.doctor_id, d.name AS doctor_name, doc.specialization, a.queue_number, TIME_FORMAT(a.time_slot, '%H:%i') AS time_slot,
                        a.status, p.name AS patient_name
                 FROM appointments a
                 JOIN users d ON d.id = a.doctor_id
                 LEFT JOIN doctors doc ON doc.user_id = a.doctor_id
                 LEFT JOIN users p ON p.id = a.patient_id
                 WHERE a.date = ? ORDER BY a.time_slot, a.queue_number`, [today]),
            query<any[]>(`SELECT COUNT(*) AS n, COALESCE(SUM(total_amount), 0) AS amount FROM bills WHERE status = 'PENDING'`),
            query<any[]>(
                `SELECT b.id, b.total_amount, p.name AS patient_name FROM bills b
                 JOIN appointments a ON a.id = b.appointment_id LEFT JOIN users p ON p.id = a.patient_id
                 WHERE b.status = 'PENDING' ORDER BY b.generated_at LIMIT 5`),
        ]);

        const count = (...s: string[]) => appointments.filter((a) => s.includes(a.status)).length;
        const doctors = new Map<number, any>();
        for (const a of appointments) {
            const d = doctors.get(a.doctor_id) ?? { id: a.doctor_id, name: a.doctor_name, specialization: a.specialization, total: 0, seen: 0, now: null, waiting: [] };
            if (a.status !== 'CANCELLED') d.total++;
            if (a.status === 'COMPLETED') d.seen++;
            const entry = { id: a.id, queue: a.queue_number, time: a.time_slot, patient: a.patient_name ?? 'Unknown patient', status: a.status };
            if (a.status === 'ONGOING') d.now = entry;
            else if (a.status === 'CHECKED_IN' || a.status === 'ARRIVED') d.waiting.push(entry);
            doctors.set(a.doctor_id, d);
        }

        const perHour = new Map<string, number>();
        for (const a of appointments) {
            if (a.status === 'CANCELLED') continue;
            const hour = String(a.time_slot).slice(0, 2) + ':00';
            perHour.set(hour, (perHour.get(hour) ?? 0) + 1);
        }

        return NextResponse.json({
            today,
            counts: {
                total: appointments.filter((a) => a.status !== 'CANCELLED').length,
                notArrived: count('PENDING', 'CONFIRMED'),
                waiting: count('CHECKED_IN', 'ARRIVED'),
                withDoctor: count('ONGOING'),
                seen: count('COMPLETED'),
                missed: count('ABSENT', 'NO_SHOW'),
            },
            queues: [...doctors.values()].filter((d) => d.total > 0).sort((a, b) => a.name.localeCompare(b.name)),
            perHour: [...perHour.entries()].sort().map(([hour, booked]) => ({ hour, booked })),
            bills: { count: Number(bills[0].n), amount: Number(bills[0].amount), oldest: oldestBills.map((b) => ({ id: b.id, patient: b.patient_name ?? 'Unknown patient', amount: Number(b.total_amount) })) },
        });
    } catch (error) {
        console.error('Receptionist dashboard error:', error);
        return NextResponse.json({ message: 'Could not load the dashboard' }, { status: 500 });
    }
}
