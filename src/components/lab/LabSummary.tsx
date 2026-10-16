'use client';

import { CheckCircle2, Clock, FlaskConical, Timer } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { SkeletonKpiRow } from '@/components/ui/skeleton';
import { ChartCard, TrendChart } from '@/components/charts';
import { useCan } from '@/components/access/AccessContext';
import { useApi } from '@/hooks/useApi';
import { minutesText } from '@/lib/hr-format';

interface Summary {
    pending: number; completedToday: number; avgTurnaroundMinutes: number | null;
    oldestPending: { id: number; test: string; patient: string; waitingMinutes: number }[];
    trend: { day: string; label: string; requested: number; completed: number }[];
}

/** Workload figures above the request list. `version` changes when the list reloads, so both stay in step. */
export function LabSummary({ version }: { version: number }) {
    const allowed = useCan('lab.dashboard', 'view');
    // Without the dashboard permission the page is just the request list
    const { data, loading, error } = useApi<Summary>(allowed ? `/api/lab-assistant/dashboard?v=${version}` : null, { refreshMs: 60_000 });
    if (!allowed) return null;
    if (error && !data) return <p role="alert" className="text-sm text-red-700">Could not load the lab summary.</p>;

    return (
        <div className="space-y-4">
            {loading && !data ? <SkeletonKpiRow count={3} /> : data && (
                <section aria-label="Lab workload" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                    <StatCard label="Waiting for results" value={data.pending} icon={FlaskConical} tone={data.pending > 0 ? 'warning' : 'neutral'}
                        hint={data.oldestPending[0] ? `Oldest: ${minutesText(data.oldestPending[0].waitingMinutes)} ago` : 'All caught up'} />
                    <StatCard label="Completed today" value={data.completedToday} icon={CheckCircle2} tone="brand" hint="Results uploaded" />
                    <StatCard label="Average turnaround" value={data.avgTurnaroundMinutes === null ? '-' : minutesText(data.avgTurnaroundMinutes)} icon={Timer} tone="info" hint="Request to result, last 30 days" className="col-span-2 lg:col-span-1" />
                </section>
            )}
            <ChartCard title="Requests and results, last 14 days" icon={Clock} loading={loading && !data} empty={data ? data.trend.every((d) => d.requested + d.completed === 0) : false} height={200}
                summary={`Lab requests and completed results per day: ${data?.trend.map((d) => `${d.label} ${d.requested}/${d.completed}`).join(', ')}.`}>
                <TrendChart data={data?.trend ?? []} xKey="label" kind="bar" series={[{ key: 'requested', label: 'Requested', color: '#0284c7' }, { key: 'completed', label: 'Completed', color: '#059669' }]} />
            </ChartCard>
        </div>
    );
}
