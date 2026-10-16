'use client';

import Link from 'next/link';
import { AlertTriangle, BarChart2, FileText, Package, Pill, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { SkeletonKpiRow } from '@/components/ui/skeleton';
import { ChartCard, DonutBreakdown, RankedBars, TrendChart } from '@/components/charts';
import { useApi } from '@/hooks/useApi';
import { formatLKR } from '@/lib/utils';

interface Stats { pendingPrescriptions: number; lowStockCount: number; outOfStockCount: number; totalMedicines: number; expiredBatchesCount: number; expiringSoonCount: number }
interface Charts {
    dailyTrend: { date: string; label: string; quantity: number; revenue: number }[];
    inventory: { assetValue: number; writeOffValue: number };
    categories: { name: string; value: number }[];
}
interface Lists {
    expiring: { name: string; batch: string; quantity: number; expiry: string; daysLeft: number }[];
    lowStock: { name: string; stock: number; minimum: number }[];
    topMedicines: { name: string; value: number }[];
    prescriptions: { day: string; label: string; issued: number }[];
}

const daysText = (n: number) => (n < 0 ? `expired ${-n} day${n === -1 ? '' : 's'} ago` : n === 0 ? 'expires today' : `${n} day${n === 1 ? '' : 's'} left`);

export default function PharmacistDashboard() {
    const stats = useApi<Stats>('/api/pharmacist/stats', { refreshMs: 60_000 });
    const charts = useApi<Charts>('/api/pharmacist/chart-data', { refreshMs: 60_000 });
    const lists = useApi<Lists>('/api/pharmacist/lists', { refreshMs: 60_000 });
    const s = stats.data, c = charts.data, l = lists.data;
    const alerts = s ? s.expiredBatchesCount + s.expiringSoonCount + s.lowStockCount + s.outOfStockCount : 0;
    const anyError = stats.error || charts.error || lists.error;

    const inventory = c ? [{ name: 'Usable stock', value: c.inventory.assetValue }, { name: 'Expired write-off', value: c.inventory.writeOffValue }] : [];

    return (
        <div className="space-y-6">
            <PageHeader title="Pharmacist Dashboard" description="Prescriptions to dispense, stock to watch and what is selling. Updates every minute." />

            {anyError && !(s && c && l) && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    Some dashboard figures could not be loaded. Reload the page; if it keeps happening, the database may be missing the latest schema updates.
                </div>
            )}

            {stats.loading && !s ? <SkeletonKpiRow count={3} /> : s && (
                <div className="grid gap-3 md:grid-cols-3">
                    <StatCard label="Pending prescriptions" value={s.pendingPrescriptions} hint="Require dispensing" icon={FileText} tone="brand" href="/pharmacist/prescriptions" />
                    <StatCard label="Alerts" value={alerts} hint="Low stock, expired or expiring" icon={AlertTriangle} tone={alerts > 0 ? 'danger' : 'warning'} href="/pharmacist/alerts" />
                    <StatCard label="Medicines" value={s.totalMedicines} hint="Registered in inventory" icon={Pill} tone="info" href="/pharmacist/inventory" />
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
                <section aria-labelledby="expiring" className="rounded-xl border border-neutral-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between"><h2 id="expiring" className="text-base font-semibold text-neutral-800">Expiring soon</h2><Link href="/pharmacist/alerts" className="text-sm font-medium text-emerald-800 hover:underline">All alerts</Link></div>
                    {!l ? <p className="text-sm text-neutral-500">Loading…</p> : l.expiring.length === 0 ? <p className="text-sm text-neutral-500">Nothing expires in the next 30 days.</p> : (
                        <ul className="divide-y text-sm">
                            {l.expiring.map((b, i) => (
                                <li key={`${i}-${b.name}-${b.batch}`} className="flex items-center justify-between gap-3 py-2">
                                    <span className="min-w-0"><span className="block truncate font-medium">{b.name}</span><span className="text-xs text-neutral-600">Batch {b.batch}, {b.quantity} left</span></span>
                                    <span className={`shrink-0 text-xs font-medium ${b.daysLeft < 0 ? 'text-red-700' : 'text-amber-800'}`}>{daysText(b.daysLeft)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
                <section aria-labelledby="low" className="rounded-xl border border-neutral-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between"><h2 id="low" className="text-base font-semibold text-neutral-800">Running low</h2><Link href="/pharmacist/inventory" className="text-sm font-medium text-emerald-800 hover:underline">Inventory</Link></div>
                    {!l ? <p className="text-sm text-neutral-500">Loading…</p> : l.lowStock.length === 0 ? <p className="text-sm text-neutral-500">Every medicine is above its minimum.</p> : (
                        <ul className="divide-y text-sm">
                            {l.lowStock.map((m, i) => (
                                <li key={`${i}-${m.name}`} className="flex items-center justify-between gap-3 py-2">
                                    <span className="truncate font-medium">{m.name}</span>
                                    <span className={`shrink-0 text-xs font-medium ${m.stock === 0 ? 'text-red-700' : 'text-amber-800'}`}>{m.stock === 0 ? 'Out of stock' : `${m.stock} left`} (minimum {m.minimum})</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <ChartCard title="Dispensing and revenue, last 30 days" icon={TrendingUp} loading={charts.loading && !c} error={charts.error && !c ? charts.error : null}
                    empty={c ? c.dailyTrend.every((d) => d.revenue === 0 && d.quantity === 0) : false} emptyText="Nothing dispensed and paid in the last 30 days."
                    summary={`Revenue and units dispensed per day over 30 days. Total revenue ${formatLKR(c?.dailyTrend.reduce((n, d) => n + d.revenue, 0) ?? 0)}.`} className="border border-neutral-200 shadow-none lg:col-span-2">
                    <TrendChart data={c?.dailyTrend ?? []} xKey="label" kind="area" series={[
                        { key: 'revenue', label: 'Revenue', kind: 'money', color: '#059669' },
                        { key: 'quantity', label: 'Units dispensed', color: '#0284c7', right: true }]} />
                </ChartCard>
                <ChartCard title="Stock value" icon={Package} loading={charts.loading && !c} empty={inventory.every((i) => i.value === 0)} emptyText="No stock recorded yet."
                    summary={`Stock value at cost: usable ${formatLKR(c?.inventory.assetValue ?? 0)}, expired ${formatLKR(c?.inventory.writeOffValue ?? 0)}.`}>
                    <DonutBreakdown data={inventory} kind="money" colors={{ 'Usable stock': '#059669', 'Expired write-off': '#dc2626' }} />
                </ChartCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <ChartCard title="Most dispensed, last 30 days" icon={Pill} loading={lists.loading && !l} empty={(l?.topMedicines.length ?? 0) === 0} emptyText="Nothing dispensed yet."
                    summary={`Units dispensed: ${l?.topMedicines.map((m) => `${m.name} ${m.value}`).join(', ')}.`} height={220}>
                    <RankedBars data={l?.topMedicines ?? []} />
                </ChartCard>
                <ChartCard title="Revenue by category" icon={BarChart2} loading={charts.loading && !c} empty={(c?.categories.length ?? 0) === 0} emptyText="No category revenue yet."
                    summary={`Revenue by category: ${c?.categories.map((x) => `${x.name} ${formatLKR(x.value)}`).join(', ')}.`} height={220}>
                    <DonutBreakdown data={c?.categories ?? []} kind="money" />
                </ChartCard>
                <ChartCard title="Prescriptions issued, last 14 days" icon={FileText} loading={lists.loading && !l} empty={l ? l.prescriptions.every((d) => d.issued === 0) : false}
                    summary={`Prescriptions per day: ${l?.prescriptions.map((d) => `${d.label} ${d.issued}`).join(', ')}.`} height={220}>
                    <TrendChart data={l?.prescriptions ?? []} xKey="label" kind="bar" series={[{ key: 'issued', label: 'Issued', color: '#0284c7' }]} />
                </ChartCard>
            </div>
        </div>
    );
}
