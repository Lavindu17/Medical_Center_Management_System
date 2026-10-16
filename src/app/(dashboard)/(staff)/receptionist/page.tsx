'use client';

import Link from 'next/link';
import { ArrowRight, Banknote, CalendarCheck, Clock, Stethoscope, UserCheck, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState, ErrorState } from '@/components/ui/state-views';
import { SkeletonKpiRow, SkeletonCard } from '@/components/ui/skeleton';
import { ChartCard, TrendChart } from '@/components/charts';
import { useApi } from '@/hooks/useApi';
import { formatLKR } from '@/lib/utils';

interface Entry { id: number; queue: number; time: string; patient: string; status: string }
interface Dashboard {
    today: string;
    counts: { total: number; notArrived: number; waiting: number; withDoctor: number; seen: number; missed: number };
    queues: { id: number; name: string; specialization: string | null; total: number; seen: number; now: Entry | null; waiting: Entry[] }[];
    perHour: { hour: string; booked: number }[];
    bills: { count: number; amount: number; oldest: { id: number; patient: string; amount: number }[] };
}

export default function ReceptionistDashboard() {
    const { data, loading, error, reload } = useApi<Dashboard>('/api/receptionist/dashboard', { refreshMs: 60_000 });

    if (error && !data) return <div className="space-y-6"><PageHeader title="Reception Dashboard" description="Today at the front desk." /><ErrorState title="Could not load the dashboard" description={error} onRetry={reload} /></div>;
    const c = data?.counts;

    return (
        <div className="space-y-6">
            <PageHeader title="Reception Dashboard" description="Today at the front desk. Updates every minute." />

            {loading || !data || !c ? <SkeletonKpiRow count={4} /> : (
                <section aria-label="Today" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard label="Today's appointments" value={c.total} icon={CalendarCheck} tone="brand" href="/receptionist/appointments" hint={`${c.notArrived} yet to arrive`} />
                    <StatCard label="Waiting now" value={c.waiting} icon={Users} tone={c.waiting > 0 ? 'warning' : 'neutral'} hint={`${c.withDoctor} with a doctor`} />
                    <StatCard label="Seen today" value={c.seen} icon={UserCheck} tone="info" hint={c.missed ? `${c.missed} missed` : 'Completed visits'} />
                    <StatCard label="Bills to collect" value={data.bills.count} icon={Banknote} tone="warning" href="/receptionist/billing" hint={`${formatLKR(data.bills.amount)} outstanding`} />
                </section>
            )}

            <section aria-labelledby="queues" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 id="queues" className="text-base font-semibold text-neutral-900">Doctor queues</h2>
                    <div className="flex gap-3 text-sm font-medium">
                        <Link href="/receptionist/register" className="inline-flex min-h-9 items-center gap-1 text-emerald-700 hover:underline"><ArrowRight className="h-3.5 w-3.5" aria-hidden /> Register patient</Link>
                        <Link href="/receptionist/appointments" className="inline-flex min-h-9 items-center gap-1 text-emerald-700 hover:underline"><ArrowRight className="h-3.5 w-3.5" aria-hidden /> Check in patient</Link>
                    </div>
                </div>
                {loading || !data ? <SkeletonCard lines={4} /> : data.queues.length === 0 ? (
                    <EmptyState icon={Stethoscope} title="No appointments today" description="Booked patients show up here, grouped by doctor, once they check in." action={{ label: 'Go to appointments', href: '/receptionist/appointments' }} />
                ) : (
                    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {data.queues.map((q) => (
                            <li key={q.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-[var(--shadow-card)]">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="truncate font-semibold text-neutral-900">{q.name}</p>
                                        <p className="text-xs text-neutral-600">{q.specialization ?? 'Doctor'}</p>
                                    </div>
                                    <p className="shrink-0 text-xs text-neutral-600 tabular-nums">{q.seen} of {q.total} seen</p>
                                </div>
                                <div className="mt-3 space-y-2 text-sm">
                                    <p className="flex items-center gap-2">
                                        <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-neutral-500">Now</span>
                                        {q.now ? <span className="font-medium">#{q.now.queue} {q.now.patient}</span> : <span className="text-neutral-500">No one with the doctor</span>}
                                    </p>
                                    <div className="flex gap-2">
                                        <span className="w-20 shrink-0 pt-0.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">Waiting</span>
                                        {q.waiting.length === 0 ? <span className="text-neutral-500">Nobody waiting</span> : (
                                            <ol className="min-w-0 space-y-1">
                                                {q.waiting.map((w) => (
                                                    <li key={w.id} className="flex flex-wrap items-center gap-x-2"><span className="font-medium">#{w.queue} {w.patient}</span><span className="text-xs text-neutral-500">{w.time}</span></li>
                                                ))}
                                            </ol>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <div className="grid gap-4 lg:grid-cols-3">
                <ChartCard title="Bookings by hour today" icon={Clock} loading={loading} empty={(data?.perHour.length ?? 0) === 0} emptyText="No bookings today."
                    summary={`Bookings per hour today: ${data?.perHour.map((h) => `${h.hour} ${h.booked}`).join(', ')}.`} className="border border-neutral-200 shadow-none lg:col-span-2" height={200}>
                    <TrendChart data={data?.perHour ?? []} xKey="hour" kind="bar" series={[{ key: 'booked', label: 'Bookings', color: '#0284c7' }]} />
                </ChartCard>
                <section aria-labelledby="oldest-bills" className="rounded-xl border border-neutral-200 bg-white p-4">
                    <h2 id="oldest-bills" className="mb-3 text-base font-semibold text-neutral-800">Oldest unpaid bills</h2>
                    {!data || data.bills.oldest.length === 0 ? <p className="text-sm text-neutral-500">Nothing to collect.</p> : (
                        <ul className="divide-y text-sm">
                            {data.bills.oldest.map((b) => (
                                <li key={b.id}><Link href="/receptionist/billing" className="flex items-center justify-between gap-2 py-2 hover:underline"><span className="truncate">{b.patient}</span><span className="font-medium tabular-nums">{formatLKR(b.amount)}</span></Link></li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
}
