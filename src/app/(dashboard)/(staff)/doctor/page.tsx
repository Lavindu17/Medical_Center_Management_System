'use client';

import Link from 'next/link';
import { Activity, ArrowRight, Banknote, Calendar, TrendingUp, UserCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { SkeletonKpiRow } from '@/components/ui/skeleton';
import { ChartCard, TrendChart } from '@/components/charts';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { asDoctor } from '@/lib/names';
import { greeting } from '@/lib/dates';
import { formatLKR } from '@/lib/utils';

interface Stats { todayAppointments: number; upcomingAppointments: number; totalPatients: number; revenue: number }
interface Entry { id: number; queue: number; time: string; patient: string; status: string }
interface Overview {
    today: string;
    series: { day: string; label: string; appointments: number; revenue: number; upcoming: boolean }[];
    queue: { now: Entry | null; waiting: Entry[]; later: Entry[]; seen: number; total: number };
    lastThirtyDays: { completed: number; missed: number; cancelled: number; completionRate: number | null };
}

export default function DoctorDashboard() {
    const { user } = useAuth();
    const stats = useApi<Stats>('/api/doctor/stats', { refreshMs: 60_000 });
    const overview = useApi<Overview>('/api/doctor/overview', { refreshMs: 60_000 });
    const o = overview.data;
    const s = stats.data;
    const firstUpcoming = o?.series.find((d) => d.upcoming)?.label;
    const past = o?.series.filter((d) => !d.upcoming) ?? [];
    const next = o ? (o.queue.now ?? o.queue.waiting[0] ?? o.queue.later[0] ?? null) : null;

    return (
        <div className="space-y-6">
            <PageHeader
                title={`${greeting()}, ${asDoctor(user?.name)}`}
                description="Your day at a glance. Updates every minute."
                actions={<Button asChild size="lg" className="gap-2"><Link href="/doctor/appointments"><Calendar className="h-4 w-4" aria-hidden /> Today&apos;s appointments</Link></Button>}
            />

            {stats.loading && !s ? <SkeletonKpiRow count={4} /> : s && (
                <section aria-label="Overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard label="Today's appointments" value={s.todayAppointments} hint={o ? `${o.queue.seen} seen so far` : 'Scheduled for today'} icon={Calendar} tone="brand" href="/doctor/appointments" />
                    <StatCard label="Upcoming" value={s.upcomingAppointments} hint="After today" icon={Activity} tone="info" href="/doctor/appointments" />
                    <StatCard label="Patients seen" value={s.totalPatients} hint="With a completed visit" icon={Users} tone="neutral" href="/doctor/patients" />
                    <StatCard label="Earned from paid bills" value={formatLKR(s.revenue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} hint="Your fee, before commission" icon={Banknote} tone="brand" href="/doctor/earnings" />
                </section>
            )}

            <section aria-labelledby="queue" className="rounded-xl border border-neutral-200 bg-white p-4 shadow-[var(--shadow-card)]">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 id="queue" className="text-base font-semibold text-neutral-900">Today&apos;s queue</h2>
                    {o && <span className="text-xs text-neutral-600">{o.queue.seen} of {o.queue.total} seen</span>}
                </div>
                {!o ? <p className="text-sm text-neutral-500">Loading…</p> : o.queue.total === 0 ? <p className="text-sm text-neutral-500">No appointments today.</p> : (
                    <div className="grid gap-4 md:grid-cols-3">
                        <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{o.queue.now ? 'With you now' : 'Next patient'}</p>
                            {next ? (
                                <Link href={`/doctor/consultation/${next.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 hover:shadow-[var(--shadow-raised)]">
                                    <span className="min-w-0"><span className="block truncate font-semibold text-neutral-900">#{next.queue} {next.patient}</span><span className="text-xs text-neutral-600">{next.time}</span></span>
                                    <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-800">{o.queue.now ? 'Open' : 'Start'} <ArrowRight className="h-3.5 w-3.5" aria-hidden /></span>
                                </Link>
                            ) : <p className="text-sm text-neutral-500">Everyone has been seen.</p>}
                        </div>
                        <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Waiting ({o.queue.waiting.length})</p>
                            {o.queue.waiting.length === 0 ? <p className="text-sm text-neutral-500">Nobody waiting.</p> : (
                                <ol className="space-y-1 text-sm">{o.queue.waiting.slice(0, 5).map((w) => <li key={w.id} className="flex items-center justify-between gap-2"><span className="truncate">#{w.queue} {w.patient}</span><span className="text-xs text-neutral-500">{w.time}</span></li>)}</ol>
                            )}
                        </div>
                        <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Not arrived ({o.queue.later.length})</p>
                            {o.queue.later.length === 0 ? <p className="text-sm text-neutral-500">None.</p> : (
                                <ol className="space-y-1 text-sm">{o.queue.later.slice(0, 5).map((w) => <li key={w.id} className="flex items-center justify-between gap-2"><span className="truncate">#{w.queue} {w.patient}</span><StatusBadge status={w.status} size="sm" /></li>)}</ol>
                            )}
                        </div>
                    </div>
                )}
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="Appointments, past and upcoming" icon={Calendar} loading={overview.loading && !o} error={overview.error && !o ? overview.error : null}
                    empty={o ? o.series.every((d) => d.appointments === 0) : false} summary={`Appointments per day from a week ago to a week ahead: ${o?.series.map((d) => `${d.label} ${d.appointments}`).join(', ')}. Days after today are upcoming.`}>
                    <TrendChart data={o?.series ?? []} xKey="label" kind="bar" shadeFrom={firstUpcoming} series={[{ key: 'appointments', label: 'Appointments', color: '#059669' }]} />
                </ChartCard>
                <ChartCard title="Earned per day (paid bills), last 7 days" icon={TrendingUp} loading={overview.loading && !o} error={overview.error && !o ? overview.error : null}
                    empty={past.every((d) => d.revenue === 0)} emptyText="No paid bills in the last week yet."
                    summary={`Your fee on paid bills per day: ${past.map((d) => `${d.label} ${d.revenue}`).join(', ')}.`}>
                    <TrendChart data={past.slice(-7)} xKey="label" kind="area" series={[{ key: 'revenue', label: 'Earned', kind: 'money', color: '#0d9488' }]} />
                </ChartCard>
            </div>

            {o && (
                <section aria-label="Last 30 days" className="grid grid-cols-3 gap-3">
                    <StatCard label="Completion rate" value={o.lastThirtyDays.completionRate === null ? '-' : `${o.lastThirtyDays.completionRate}%`} icon={UserCheck} tone="brand" hint="Booked visits that were seen, last 30 days" />
                    <StatCard label="Seen" value={o.lastThirtyDays.completed} tone="neutral" hint="Last 30 days" />
                    <StatCard label="Missed or cancelled" value={o.lastThirtyDays.missed + o.lastThirtyDays.cancelled} tone={o.lastThirtyDays.missed > 0 ? 'warning' : 'neutral'} hint={`${o.lastThirtyDays.missed} no-show, ${o.lastThirtyDays.cancelled} cancelled`} />
                </section>
            )}
        </div>
    );
}
