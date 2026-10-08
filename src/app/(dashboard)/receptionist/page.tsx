
import { pool } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, Banknote, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/state-views';
import { formatLKR } from '@/lib/utils';
import { Button } from '@/components/ui/button';

async function getStats() {
    const today = new Date().toISOString().split('T')[0];

    const [apptStats]: any = await pool.query(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'CHECKED_IN' THEN 1 ELSE 0 END) as checked_in,
            SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
        FROM appointments 
        WHERE date = ?
    `, [today]);

    const [billStats]: any = await pool.query(`
        SELECT 
            COUNT(*) as pending_count,
            SUM(total_amount) as pending_amount
        FROM bills 
        WHERE status = 'PENDING'
    `);

    return {
        appointments: apptStats[0],
        billing: billStats[0]
    };
}

export default async function ReceptionistDashboard() {
    const stats = await getStats();

    return (
        <div className="space-y-6">
            <PageHeader title="Reception Dashboard" description="Today's overview at a glance." />

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard
                    label="Today's appointments" value={stats.appointments.total} icon={Calendar} href="/receptionist/appointments"
                    hint={`${stats.appointments.checked_in} checked in, ${stats.appointments.pending} waiting`}
                />
                <StatCard
                    label="Pending bills" value={stats.billing.pending_count} icon={Banknote} tone="warning" href="/receptionist/billing"
                    hint={`${formatLKR(stats.billing.pending_amount || 0)} to collect`}
                />
                <StatCard
                    label="Completed today" value={stats.appointments.completed} icon={Clock} tone="info"
                    hint="Patients seen today"
                />
                <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4 shadow-[var(--shadow-card)]">
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Quick actions</p>
                    <Link href="/receptionist/register" className="flex min-h-9 items-center gap-2 text-sm font-medium text-emerald-700 hover:underline">
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden /> Register patient
                    </Link>
                    <Link href="/receptionist/appointments" className="flex min-h-9 items-center gap-2 text-sm font-medium text-emerald-700 hover:underline">
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden /> Check in patient
                    </Link>
                </div>
            </div>

            <EmptyState
                icon={Users}
                title="Doctor queues will appear here"
                description="Once patients are checked in, each doctor's waiting list shows up on this screen."
                action={{ label: 'Go to appointments', href: '/receptionist/appointments' }}
            />
        </div>
    );
}
