'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatLKR } from '@/lib/utils';
import {
    Banknote, TrendingUp, TrendingDown, Package, Pill,
    FlaskConical, Stethoscope, AlertTriangle, ChevronDown,
    BarChart2, Activity, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import {
    ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ReTooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
    AreaChart, Area, ReferenceLine,
} from 'recharts';

/* ── Centralised theme — aligned with globals.css green healthcare theme ── */
const THEME = {
    primary:  '#10B981', // emerald-500 — main primary action (ring color in globals)
    mint:     '#73E6CA', // #73E6CA — brand mint green (--primary in globals)
    teal:     '#0891B2', // teal-600 — secondary accent (chart-adjacent)
    emerald:  '#059669', // emerald-600 — sidebar primary in globals
    orange:   '#F97316', // orange — costs/COGS (intentional warm contrast)
    red:      '#EF4444', // red — losses/write-offs
    slate:    '#94A3B8', // slate-400 — muted/axes
    neutral:  '#E5E7EB', // gray-200 — grid lines
} as const;

// Pie chart slices: all green-family for cohesion
const REVENUE_COLORS = [THEME.primary, THEME.mint, THEME.emerald, THEME.teal];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* ── Types ───────────────────────────────────────────────────── */
interface DailyEntry { date: string; gross_revenue: number; patient_billed: number; }
interface FinancialData {
    revenue: { service_charges: number; doctor_commissions: number; lab_revenue: number; pharmacy_revenue: number; gross_revenue: number; };
    cogs: { medicine_cogs: number; lab_cogs: number; total_cogs: number; };
    inventory: { asset_value: number; write_off_value: number; };
    profit: { total_doctor_payouts: number; true_gross_profit: number; };
    doctor_payouts: Array<{
        doctor_name: string; specialization: string; commission_rate: number;
        completed_appointments: number; gross_charged: number; center_commission: number; net_payout: number;
    }>;
    daily: DailyEntry[];
}

/* ── Helpers ─────────────────────────────────────────────────── */
const pct = (part: number, total: number) => total ? ((part / total) * 100).toFixed(1) : '0.0';
const halfTrend = (curr: number, prev: number) => prev ? ((curr - prev) / prev) * 100 : null;

/* ── Custom tooltip for currency ─────────────────────────────── */
function CurrencyTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-neutral-200 rounded-lg shadow-lg px-3 py-2 text-xs">
            <p className="font-semibold text-neutral-700 mb-1">{label}</p>
            {payload.map((p: any) => (
                <p key={p.dataKey} style={{ color: p.color }} className="font-mono">
                    {p.name}: {formatLKR(p.value)}
                </p>
            ))}
        </div>
    );
}

/* ── KPI Card ────────────────────────────────────────────────── */
function KpiCard({ label, value, sub, icon: Icon, color, delta, negative = false }: {
    label: string; value: number; sub?: string; icon: React.ElementType;
    color: string; delta?: number | null; negative?: boolean;
}) {
    const isUp = delta != null && delta >= 0;
    return (
        <Card className="border border-neutral-100 bg-white hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                    <span className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">{label}</span>
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: color + '1a' }}>
                        <Icon className="h-3.5 w-3.5" style={{ color }} />
                    </div>
                </div>
                <div className="text-xl font-bold text-neutral-900 font-mono tabular-nums">
                    {negative && value > 0 ? '−' : ''}{formatLKR(value)}
                </div>
                <div className="flex items-center justify-between mt-2">
                    {sub && <span className="text-xs text-neutral-400">{sub}</span>}
                    {delta !== undefined && delta !== null && (
                        <span className={`flex items-center gap-0.5 text-xs font-medium ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
                            {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {Math.abs(delta).toFixed(1)}% vs prev
                        </span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

/* ══════════════════════════════════════════════════════════════ */
export default function RevenuePage() {
    const [data, setData] = useState<FinancialData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showDoctors, setShowDoctors] = useState(false);

    const now = useMemo(() => new Date(), []);
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());

    useEffect(() => {
        setLoading(true);
        // month is 0-indexed in JS but 1-indexed for MySQL MONTH()
        fetch(`/api/admin/revenue?month=${selectedMonth + 1}&year=${selectedYear}`)
            .then(r => r.json())
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [selectedMonth, selectedYear]);

    /* ── Derive chart datasets from daily array ── */
    const { weeklyData, dailyData, halfDelta, firstHalfTotal, secondHalfTotal, availableYears } = useMemo(() => {
        const raw = data?.daily ?? [];
        const daily = raw.map(d => ({
            date: d.date,
            gross: Number(d.gross_revenue),
            billed: Number(d.patient_billed),
            label: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        }));

        // Weekly aggregation
        const weeklyData: { week: string; center: number; billed: number }[] = [];
        for (let i = 0; i < daily.length; i += 7) {
            const slice = daily.slice(i, i + 7);
            weeklyData.push({
                week: `Week ${Math.floor(i / 7) + 1}`,
                center: slice.reduce((s, d) => s + d.gross, 0),
                billed: slice.reduce((s, d) => s + d.billed, 0),
            });
        }

        // Half-period comparison (first 15 days vs last 15 days)
        const mid = Math.floor(daily.length / 2);
        const firstHalfTotal = daily.slice(0, mid).reduce((s, d) => s + d.gross, 0);
        const secondHalfTotal = daily.slice(mid).reduce((s, d) => s + d.gross, 0);
        const halfDelta = halfTrend(secondHalfTotal, firstHalfTotal);

        // Unique years from daily dates + current year
        const yearsFromData = raw
            .map(d => new Date(d.date).getFullYear())
            .filter((v, i, a) => a.indexOf(v) === i);
        const availableYears = Array.from(new Set([now.getFullYear(), ...yearsFromData])).sort((a, b) => b - a);

        return { weeklyData, dailyData: daily, halfDelta, firstHalfTotal, secondHalfTotal, availableYears };
    }, [data, now]);

    /* ── Loading / error states ── */
    if (loading) return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-neutral-400 font-medium">Loading analytics…</span>
            </div>
        </div>
    );
    if (!data?.revenue) return (
        <div className="p-8 text-red-500 text-sm">Failed to load financial data.</div>
    );

    const { revenue, cogs, inventory, profit, doctor_payouts, daily } = data;
    const marginPct = revenue.gross_revenue > 0 ? (profit.true_gross_profit / revenue.gross_revenue) * 100 : 0;
    const isProfit = profit.true_gross_profit >= 0;

    /* Pie data */
    const revenuePieData = [
        { name: 'Services',      value: Number(revenue.service_charges) },
        { name: 'Doctor Comm.', value: Number(revenue.doctor_commissions) },
        { name: 'Lab',           value: Number(revenue.lab_revenue) },
        { name: 'Pharmacy',      value: Number(revenue.pharmacy_revenue) },
    ];

    /* Waterfall bar data */
    const waterfallData = [
        { name: 'Gross Revenue',  value: Number(revenue.gross_revenue),         fill: THEME.primary },
        { name: 'COGS',           value: -Number(cogs.total_cogs),              fill: THEME.orange },
        { name: 'Dr. Payouts',    value: -Number(profit.total_doctor_payouts),  fill: THEME.teal },
        { name: 'Write-offs',     value: -Number(inventory.write_off_value),    fill: THEME.red },
        { name: 'Net Profit',     value: Number(profit.true_gross_profit),      fill: isProfit ? THEME.mint : THEME.red },
    ];

    return (
        <div className="p-5 md:p-7 space-y-6 max-w-7xl mx-auto">

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-neutral-900 tracking-tight">Revenue Analytics</h1>
                    <p className="text-xs text-neutral-400 mt-0.5">
                        {MONTHS[selectedMonth]} {selectedYear} · Sethro Medical Center
                    </p>
                </div>

                <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2">
                    <Activity className="h-3.5 w-3.5 flex-shrink-0" style={{ color: THEME.primary }} />
                    <select
                        id="select-month"
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(Number(e.target.value))}
                        className="text-xs font-medium text-neutral-700 bg-transparent outline-none cursor-pointer"
                    >
                        {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                    </select>
                    <select
                        id="select-year"
                        value={selectedYear}
                        onChange={e => setSelectedYear(Number(e.target.value))}
                        className="text-xs font-medium text-neutral-700 bg-transparent outline-none cursor-pointer"
                    >
                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full border ml-1" style={{ backgroundColor: THEME.primary + '18', color: THEME.teal, borderColor: THEME.mint }}>
                        Filtered
                    </span>
                </div>
            </div>

            {/* ── KPI Row ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard label="Gross Revenue"  value={revenue.gross_revenue}         icon={Banknote}       color={THEME.primary} sub="All income streams" delta={halfDelta} />
                <KpiCard label="Total COGS"     value={cogs.total_cogs}               icon={TrendingDown}   color={THEME.orange}  sub="Meds + Lab costs"  negative />
                <KpiCard label="Doctor Payouts" value={profit.total_doctor_payouts}   icon={Stethoscope}    color={THEME.teal} sub="Net earnings paid"  negative />

                <Card className={`border-2 ${isProfit ? 'border-emerald-200 bg-emerald-50/60' : 'border-red-200 bg-red-50/60'}`}>
                    <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Net Profit</span>
                            {isProfit
                                ? <TrendingUp  className="h-4 w-4 text-emerald-600" />
                                : <TrendingDown className="h-4 w-4 text-red-500" />}
                        </div>
                        <div className={`text-xl font-bold font-mono tabular-nums ${isProfit ? 'text-emerald-700' : 'text-red-600'}`}>
                            {!isProfit && '−'}{formatLKR(Math.abs(profit.true_gross_profit))}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-neutral-400">True gross profit</span>
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${isProfit ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                {marginPct.toFixed(1)}% margin
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Revenue Mix + Weekly Bars ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Recharts Pie */}
                <Card className="border border-neutral-100">
                    <CardHeader className="pb-0 pt-4 px-4">
                        <CardTitle className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Revenue Mix</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                        <ResponsiveContainer width="100%" height={160}>
                            <PieChart>
                                <Pie
                                    data={revenuePieData}
                                    cx="50%" cy="50%"
                                    innerRadius={45} outerRadius={70}
                                    paddingAngle={2}
                                    dataKey="value"
                                    strokeWidth={0}
                                >
                                    {revenuePieData.map((_, i) => (
                                        <Cell key={i} fill={REVENUE_COLORS[i % REVENUE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <ReTooltip formatter={(v: any) => formatLKR(Number(v))} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-1.5 mt-2">
                            {revenuePieData.map((s, i) => (
                                <div key={s.name} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: REVENUE_COLORS[i % REVENUE_COLORS.length] }} />
                                        <span className="text-neutral-600">{s.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-neutral-700">{formatLKR(s.value)}</span>
                                        <span className="text-neutral-400 w-9 text-right">{pct(s.value, revenue.gross_revenue)}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Recharts Grouped Bar — weekly */}
                <Card className="border border-neutral-100 lg:col-span-2">
                    <CardHeader className="pb-0 pt-4 px-4 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Weekly Revenue (Last 30 Days)</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                        {/* Half-period comparison callout */}
                        {halfDelta !== null && (
                            <div className={`mb-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${halfDelta >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                                {halfDelta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0" /> : <ArrowDownRight className="h-3.5 w-3.5 flex-shrink-0" />}
                                <span>
                                    Recent 15 days vs prior 15 days:&nbsp;
                                    <strong>{halfDelta >= 0 ? '+' : ''}{halfDelta.toFixed(1)}%</strong>
                                    &nbsp;({formatLKR(secondHalfTotal)} vs {formatLKR(firstHalfTotal)})
                                </span>
                            </div>
                        )}
                        <ResponsiveContainer width="100%" height={160}>
                            <BarChart data={weeklyData} barGap={4} barCategoryGap="30%">
                                <CartesianGrid strokeDasharray="3 3" stroke={THEME.neutral} vertical={false} />
                                <XAxis dataKey="week" tick={{ fontSize: 10, fill: THEME.slate }} axisLine={false} tickLine={false} />
                                <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: THEME.slate }} axisLine={false} tickLine={false} width={36} />
                                <ReTooltip content={<CurrencyTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 10, color: THEME.slate }} />
                                <Bar dataKey="billed" name="Patient Billed" fill={THEME.neutral}  radius={[3,3,0,0]} />
                                <Bar dataKey="center" name="Center Revenue"  fill={THEME.primary} radius={[3,3,0,0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* ── Daily area chart ── */}
            <Card className="border border-neutral-100">
                <CardHeader className="pb-0 pt-4 px-4">
                    <CardTitle className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Daily Revenue Trend — Last 30 Days</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                    <ResponsiveContainer width="100%" height={160}>
                        <AreaChart data={dailyData}>
                            <defs>
                                <linearGradient id="gradCenter" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%"  stopColor={THEME.primary} stopOpacity={0.25} />
                                    <stop offset="95%" stopColor={THEME.primary} stopOpacity={0}    />
                                </linearGradient>
                                <linearGradient id="gradBilled" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%"  stopColor={THEME.slate}  stopOpacity={0.15} />
                                    <stop offset="95%" stopColor={THEME.slate}  stopOpacity={0}    />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.neutral} vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 9, fill: THEME.slate }} axisLine={false} tickLine={false} interval={4} />
                            <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 9, fill: THEME.slate }} axisLine={false} tickLine={false} width={32} />
                            <ReTooltip content={<CurrencyTooltip />} />
                            <Area dataKey="billed" name="Patient Billed" stroke={THEME.slate}   fill="url(#gradBilled)" strokeWidth={1.5} dot={false} />
                            <Area dataKey="gross"  name="Center Revenue" stroke={THEME.primary} fill="url(#gradCenter)" strokeWidth={2}   dot={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* ── COGS + Inventory KPIs ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard label="Medicine COGS"    value={cogs.medicine_cogs}        icon={Pill}          color={THEME.orange}  sub={`${pct(cogs.medicine_cogs, cogs.total_cogs)}% of COGS`}   negative />
                <KpiCard label="Lab COGS"         value={cogs.lab_cogs}             icon={FlaskConical}  color={THEME.teal}    sub={`${pct(cogs.lab_cogs, cogs.total_cogs)}% of COGS`}         negative />
                <KpiCard label="Inventory Value"  value={inventory.asset_value}     icon={Package}       color={THEME.primary} sub="Active stock · balance sheet" />
                <KpiCard label="Write-Offs"       value={inventory.write_off_value} icon={AlertTriangle} color={THEME.red}     sub="Expired stock loss" negative />
            </div>

            {/* ── Profit waterfall (Recharts BarChart) ── */}
            <Card className="border border-neutral-100">
                <CardHeader className="pb-0 pt-4 px-4">
                    <CardTitle className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Profit Waterfall</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                    <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={waterfallData} barCategoryGap="35%">
                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.neutral} vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: THEME.slate }} axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: THEME.slate }} axisLine={false} tickLine={false} width={36} />
                            <ReTooltip formatter={(v: any) => formatLKR(Math.abs(Number(v)))} />
                            <ReferenceLine y={0} stroke={THEME.slate} strokeDasharray="3 3" />
                            <Bar dataKey="value" name="Amount" radius={[4,4,0,0]}>
                                {waterfallData.map((entry, i) => (
                                    <Cell key={i} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    {/* Text summary row */}
                    <div className="mt-3 pt-3 border-t border-neutral-100 flex flex-wrap gap-x-6 gap-y-1">
                        {waterfallData.map(row => (
                            <div key={row.name} className="flex items-center gap-1.5 text-xs">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: row.fill }} />
                                <span className="text-neutral-500">{row.name}:</span>
                                <span className="font-mono font-semibold text-neutral-700 tabular-nums">{formatLKR(Math.abs(row.value))}</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* ── Doctor Payouts ── */}
            <section>
                <button
                    id="toggle-doctor-payouts"
                    className="flex items-center gap-2 text-sm font-semibold text-neutral-700 transition-colors duration-150 cursor-pointer mb-3 hover:text-emerald-600"
                    onClick={() => setShowDoctors(!showDoctors)}
                >
                    <BarChart2 className="h-4 w-4" />
                    Doctor Payout Breakdown
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showDoctors ? 'rotate-180' : ''}`} />
                </button>

                {showDoctors && (
                    <Card className="border border-neutral-100">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-neutral-50 border-b border-neutral-100">
                                        <tr>
                                            {['Doctor','Specialty','Appts','Rate','Gross Billed','Center Kept','Net Payout'].map(h => (
                                                <th key={h} className="p-3 text-left text-[10px] font-semibold text-neutral-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-50">
                                        {doctor_payouts.length === 0 ? (
                                            <tr><td colSpan={7} className="p-6 text-center text-neutral-400 text-xs">No completed appointments yet.</td></tr>
                                        ) : doctor_payouts.map((d, i) => (
                                            <tr key={i} className="hover:bg-neutral-50 transition-colors duration-100">
                                                <td className="p-3 font-medium text-neutral-800 text-xs">{d.doctor_name}</td>
                                                <td className="p-3 text-neutral-500 text-xs">{d.specialization}</td>
                                                <td className="p-3 text-center font-bold text-xs text-neutral-700">{d.completed_appointments}</td>
                                                <td className="p-3 text-xs text-neutral-500">{d.commission_rate}%</td>
                                                <td className="p-3 font-mono text-xs text-neutral-700 tabular-nums">{formatLKR(d.gross_charged)}</td>
                                                <td className="p-3 font-mono text-xs font-semibold tabular-nums" style={{ color: THEME.teal }}>{formatLKR(d.center_commission)}</td>
                                                <td className="p-3 font-mono text-xs font-bold tabular-nums" style={{ color: THEME.primary }}>{formatLKR(d.net_payout)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </section>
        </div>
    );
}
