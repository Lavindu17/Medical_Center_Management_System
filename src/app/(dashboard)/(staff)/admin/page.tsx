'use client';

import Link from 'next/link';
import { Activity, AlertTriangle, Banknote, Calendar, CalendarOff, ClipboardCheck, Package, ShieldCheck, Stethoscope, UserCheck, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { ErrorState } from '@/components/ui/state-views';
import { SkeletonKpiRow } from '@/components/ui/skeleton';
import { ChangeBadge, ChartCard, DonutBreakdown, RankedBars, TrendChart } from '@/components/charts';
import { useApi } from '@/hooks/useApi';
import { formatLKR } from '@/lib/utils';

interface Dashboard {
    today: string; patients: number; staff: number; todayAppointments: number;
    todayStatus: { name: string; value: number }[];
    appointments: { day: string; label: string; booked: number; completed: number }[];
    topDoctors: { name: string; value: number }[];
    revenue: { thisMonth: number; lastMonth: number; change: number | null };
    attention: { pendingLeave: number; pendingCorrections: number; lowStock: number; expiringBatches: number; doctorsOnLeave: number };
    health: { database: string; audit: { status: 'ok' | 'broken' | 'skipped' | 'unavailable'; checked?: number } };
}

const STATUS_COLOR: Record<string, string> = {
    PENDING: '#d97706', CHECKED_IN: '#0284c7', ONGOING: '#0d9488', COMPLETED: '#059669', CANCELLED: '#9ca3af', ABSENT: '#dc2626', NO_SHOW: '#dc2626',
};
const STATUS_LABEL: Record<string, string> = { PENDING: 'Waiting', CHECKED_IN: 'Checked in', ONGOING: 'With doctor', COMPLETED: 'Seen', CANCELLED: 'Cancelled', ABSENT: 'Absent', NO_SHOW: 'No-show' };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function AdminDashboard() {
    const { data, loading, error, reload } = useApi<Dashboard>('/api/admin/dashboard', { refreshMs: 60_000 });

    if (error && !data) return <div className="space-y-6"><PageHeader title="Admin Dashboard" description="How the clinic is running today." /><ErrorState title="Could not load the dashboard" description={error} onRetry={reload} /></div>;

    const a = data?.attention;
    const items = a ? [
        { n: a.pendingLeave, text: plural(a.pendingLeave, 'leave request') + ' waiting for a decision', href: '/hr/leave', icon: CalendarOff },
        { n: a.pendingCorrections, text: plural(a.pendingCorrections, 'attendance correction') + ' waiting', href: '/hr/attendance', icon: ClipboardCheck },
        { n: a.lowStock, text: plural(a.lowStock, 'medicine') + ' low or out of stock', href: '/pharmacist/alerts', icon: Package },
        { n: a.expiringBatches, text: plural(a.expiringBatches, 'stock batch') + ' expired or expiring within 30 days', href: '/pharmacist/alerts', icon: AlertTriangle },
        { n: a.doctorsOnLeave, text: plural(a.doctorsOnLeave, 'doctor') + ' on leave today', href: '/admin/doctors', icon: Stethoscope },
    ].filter((i) => i.n > 0) : [];

    const status = data?.todayStatus.map((s) => ({ name: STATUS_LABEL[s.name] ?? s.name, value: s.value })) ?? [];
    const colors = Object.fromEntries(Object.entries(STATUS_LABEL).map(([k, v]) => [v, STATUS_COLOR[k]]));
    const booked = data?.appointments.map((d) => d.booked).join(', ') ?? '';

    return (
        <div className="space-y-6">
            <PageHeader title="Admin Dashboard" description="How the clinic is running today. Figures refresh every minute." />

            {loading || !data ? <SkeletonKpiRow count={4} /> : (
                <section aria-label="Overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard label="Today's appointments" value={data.todayAppointments} hint="Booked for today" icon={Calendar} tone="brand" />
                    <StatCard label="Patients" value={data.patients} hint="Registered patients" icon={Users} tone="info" />
                    <StatCard label="Staff" value={data.staff} hint="Doctors, pharmacists and others" icon={UserCheck} tone="neutral" href="/admin/users" />
                    <StatCard label="Revenue this month" value={formatLKR(data.revenue.thisMonth, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        hint={<ChangeBadge change={data.revenue.change} />} icon={Banknote} href="/admin/revenue" />
                </section>
            )}

            {items.length > 0 && (
                <section aria-label="Needs attention" className="space-y-2">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Needs attention</h2>
                    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {items.map((i) => (
                            <li key={i.text}>
                                <Link href={i.href} className="flex min-h-12 items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 hover:shadow-[var(--shadow-raised)]">
                                    <i.icon className="h-4 w-4 shrink-0" aria-hidden /> {i.text}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
                <ChartCard title="Appointments, last 14 days" icon={Calendar} loading={loading} error={error} empty={data ? data.appointments.every((d) => d.booked === 0) : false}
                    summary={`Appointments booked per day for the last 14 days: ${booked}.`} className="border border-neutral-200 shadow-none lg:col-span-2">
                    <TrendChart data={data?.appointments ?? []} xKey="label" kind="bar"
                        series={[{ key: 'booked', label: 'Booked', color: '#0284c7' }, { key: 'completed', label: 'Seen', color: '#059669' }]} />
                </ChartCard>
                <ChartCard title="Today by status" icon={Activity} loading={loading} empty={status.length === 0} emptyText="No appointments today."
                    summary={`Today's appointments by status: ${status.map((s) => `${s.name} ${s.value}`).join(', ')}.`}>
                    <DonutBreakdown data={status} colors={colors} />
                </ChartCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <ChartCard title="Busiest doctors, last 30 days" icon={Stethoscope} loading={loading} empty={(data?.topDoctors.length ?? 0) === 0}
                    summary={`Appointments by doctor: ${data?.topDoctors.map((d) => `${d.name} ${d.value}`).join(', ')}.`} className="border border-neutral-200 shadow-none lg:col-span-2" height={220}>
                    <RankedBars data={data?.topDoctors ?? []} />
                </ChartCard>
                <section aria-labelledby="health" className="rounded-xl border border-neutral-200 bg-white p-4">
                    <h2 id="health" className="mb-3 flex items-center gap-2 text-base font-semibold text-neutral-800"><ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden /> System checks</h2>
                    {data && (
                        <ul className="space-y-2 text-sm">
                            <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-600" aria-hidden /> Database responding</li>
                            <li className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${data.health.audit.status === 'ok' ? 'bg-emerald-600' : data.health.audit.status === 'broken' ? 'bg-red-600' : 'bg-neutral-400'}`} aria-hidden />
                                {data.health.audit.status === 'ok' && `Audit trail intact (${data.health.audit.checked} entries checked)`}
                                {data.health.audit.status === 'broken' && <Link href="/admin/logs" className="font-medium text-red-700 underline">Audit trail check failed. Open the log.</Link>}
                                {data.health.audit.status === 'skipped' && <Link href="/admin/logs" className="underline">Audit trail is large: verify it from the log page</Link>}
                                {data.health.audit.status === 'unavailable' && 'Audit trail not set up'}
                            </li>
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
}
