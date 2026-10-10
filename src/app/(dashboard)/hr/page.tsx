'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CalendarOff, ClipboardCheck, Clock, UserCheck, UserX, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state-views';
import { useApi } from '@/hooks/useApi';
import { ROLE_LABEL, dayText, minutesText, shiftText } from '@/lib/hr-format';
import { cn } from '@/lib/utils';

interface Overview {
    today: string; timezone: string; pendingLeave: number; pendingCorrections: number;
    counts: { staff: number; working: number; late: number; absent: number; onLeave: number; scheduled: number; dayOff: number; holiday: number; missingClockOut: number };
    people: { id: number; name: string; role: string; department: string | null; status: string; openNow: boolean; lateMinutes: number; shifts: { id: number; start: string; end: string }[] }[];
}

const FILTERS = [
    { value: 'ALL', label: 'Everyone' }, { value: 'WORKING', label: 'In now' }, { value: 'LATE', label: 'Late' },
    { value: 'ABSENT', label: 'Absent' }, { value: 'ON_LEAVE', label: 'On leave' }, { value: 'SCHEDULED', label: 'Yet to start' },
];

export default function HrOverviewPage() {
    const { data, loading, error, reload } = useApi<Overview>('/api/hr/overview');
    const [filter, setFilter] = useState('ALL');

    const people = useMemo(() => {
        if (!data) return [];
        return data.people.filter((p) => {
            switch (filter) {
                case 'WORKING': return p.status === 'PRESENT' || p.status === 'LATE';
                case 'LATE': return p.status === 'LATE';
                case 'ABSENT': return p.status === 'ABSENT';
                case 'ON_LEAVE': return p.status === 'ON_LEAVE';
                case 'SCHEDULED': return p.status === 'SCHEDULED';
                default: return p.status !== 'DAY_OFF' || p.openNow;
            }
        });
    }, [data, filter]);

    if (loading && !data) return <LoadingState label="Loading HR overview…" />;
    if (error || !data) return <ErrorState title="Could not load the HR overview" description={error ?? 'If this is a new install, run 20_hr.sql on the database.'} onRetry={reload} />;
    const c = data.counts;

    return (
        <div className="space-y-6">
            <PageHeader title="HR overview" description={`Where everyone is today, ${dayText(data.today)}. Times are in ${data.timezone}.`} />

            <section aria-label="Today" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="In now" value={c.working} hint={`of ${c.staff} staff`} icon={UserCheck} />
                <StatCard label="Late" value={c.late} tone={c.late ? 'warning' : 'neutral'} icon={Clock} />
                <StatCard label="Absent" value={c.absent} tone={c.absent ? 'danger' : 'neutral'} icon={UserX} hint="Shift over, no punch" />
                <StatCard label="On leave" value={c.onLeave} tone="info" icon={CalendarOff} href="/hr/leave" />
            </section>

            {(data.pendingLeave > 0 || data.pendingCorrections > 0 || c.missingClockOut > 0) && (
                <section aria-label="Needs attention" className="grid gap-3 sm:grid-cols-3">
                    {data.pendingLeave > 0 && (
                        <Link href="/hr/leave" className="rounded-xl border border-amber-200 bg-warning-soft p-4 text-warning hover:shadow-[var(--shadow-raised)]">
                            <p className="text-2xl font-bold">{data.pendingLeave}</p><p className="text-sm font-medium">leave request{data.pendingLeave === 1 ? '' : 's'} waiting</p>
                        </Link>
                    )}
                    {data.pendingCorrections > 0 && (
                        <Link href="/hr/attendance" className="rounded-xl border border-amber-200 bg-warning-soft p-4 text-warning hover:shadow-[var(--shadow-raised)]">
                            <p className="text-2xl font-bold">{data.pendingCorrections}</p><p className="text-sm font-medium">attendance correction{data.pendingCorrections === 1 ? '' : 's'} waiting</p>
                        </Link>
                    )}
                    {c.missingClockOut > 0 && (
                        <Link href="/hr/attendance" className="rounded-xl border border-amber-200 bg-warning-soft p-4 text-warning hover:shadow-[var(--shadow-raised)]">
                            <p className="text-2xl font-bold">{c.missingClockOut}</p><p className="text-sm font-medium">missing clock-out{c.missingClockOut === 1 ? '' : 's'} in the last 2 weeks</p>
                        </Link>
                    )}
                </section>
            )}

            <section aria-labelledby="who-heading" className="space-y-3">
                <h2 id="who-heading" className="text-base font-semibold text-neutral-900">Who is where</h2>
                <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0" role="group" aria-label="Filter">
                    {FILTERS.map((f) => (
                        <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}
                            className={cn('min-h-10 shrink-0 rounded-full border px-3.5 text-sm font-medium', filter === f.value ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-neutral-200 bg-white text-neutral-700')}>
                            {f.label}
                        </button>
                    ))}
                </div>
                {people.length === 0 ? (
                    <EmptyState icon={Users} title="Nobody matches" description="Add shifts in the roster so people show up here." action={{ label: 'Open roster', href: '/hr/roster' }} />
                ) : (
                    <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[var(--shadow-card)]">
                        {people.map((p) => (
                            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                                <div className="min-w-0">
                                    <Link href={`/hr/employees/${p.id}`} className="font-semibold text-neutral-900 hover:underline">{p.name}</Link>
                                    <p className="text-xs text-neutral-600">{ROLE_LABEL[p.role] ?? p.role}{p.department ? ` · ${p.department}` : ''}{p.shifts.length > 0 ? ` · ${p.shifts.map(shiftText).join(', ')}` : ''}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {p.lateMinutes > 0 && <span className="text-xs text-amber-800">{minutesText(p.lateMinutes)} late</span>}
                                    <StatusBadge status={p.status} kind="attendance" size="sm" />
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <Link href="/hr/attendance" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-emerald-800 hover:underline"><ClipboardCheck className="h-4 w-4" aria-hidden /> Open attendance reports</Link>
        </div>
    );
}
