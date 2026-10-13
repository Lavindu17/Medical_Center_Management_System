'use client';

import * as React from 'react';
import {
    Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
    ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatLKR } from '@/lib/utils';

/** Colours used across every chart, so the same thing is the same colour on every dashboard. */
export const CHART_COLORS = {
    brand: '#059669', teal: '#0d9488', sky: '#0284c7', amber: '#d97706', red: '#dc2626', slate: '#64748b', grid: '#e5e7eb', axis: '#6b7280',
} as const;
const PALETTE = [CHART_COLORS.brand, CHART_COLORS.sky, CHART_COLORS.amber, CHART_COLORS.teal, CHART_COLORS.red, CHART_COLORS.slate];

export type ValueKind = 'number' | 'money';

/** 500 -> 500, 2,500 -> 2.5k, 1,200,000 -> 1.2M */
export function compactNumber(value: number): string {
    if (!Number.isFinite(value)) return '';
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${+(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${+(value / 1_000).toFixed(1)}k`;
    return String(+value.toFixed(1));
}
export const compactLKR = (value: number) => (Number.isFinite(value) ? `LKR ${compactNumber(value)}` : '');
const formatValue = (value: number, kind: ValueKind) => (kind === 'money' ? formatLKR(value) : String(value));
const formatAxis = (value: number, kind: ValueKind) => (kind === 'money' ? compactLKR(value) : compactNumber(value));

export interface Series {
    key: string;
    label: string;
    color?: string;
    kind?: ValueKind;
    /** Draw on the right-hand axis (for a second unit, such as money against counts) */
    right?: boolean;
}

function ChartTooltip({ active, payload, label, series }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-lg">
            {label !== undefined && <p className="mb-1 font-semibold text-neutral-700">{label}</p>}
            {payload.map((p: any) => {
                const s: Series | undefined = series?.find((x: Series) => x.key === p.dataKey);
                return (
                    <p key={String(p.dataKey)} className="tabular-nums" style={{ color: p.color || p.payload?.fill }}>
                        {s?.label ?? p.name}: {formatValue(Number(p.value), s?.kind ?? 'number')}
                    </p>
                );
            })}
        </div>
    );
}

interface ChartCardProps {
    title: string;
    icon?: React.ComponentType<{ className?: string }>;
    /** A sentence for screen readers that says what the chart shows, for example "Appointments per day: 4, 6, 3". */
    summary?: string;
    loading?: boolean;
    error?: string | null;
    empty?: boolean;
    emptyText?: string;
    action?: React.ReactNode;
    className?: string;
    height?: number;
    children: React.ReactNode;
}

/** The frame every chart sits in: title, loading skeleton, error and empty message, and a text alternative. */
export function ChartCard({ title, icon: Icon, summary, loading, error, empty, emptyText = 'Nothing to show for this period yet.', action, className, height = 240, children }: ChartCardProps) {
    return (
        <Card className={className ?? 'border border-neutral-200 shadow-none'}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-neutral-800">
                    {Icon && <Icon className="h-4 w-4 text-emerald-700" aria-hidden />}{title}
                </CardTitle>
                {action}
            </CardHeader>
            <CardContent>
                <div style={{ height }} className="w-full">
                    {loading ? <Skeleton className="h-full w-full" />
                        : error ? <p role="alert" className="flex h-full items-center justify-center text-sm text-red-700">{error}</p>
                        : empty ? <p className="flex h-full items-center justify-center text-sm text-neutral-500">{emptyText}</p>
                        : <div role="img" aria-label={summary ?? title} className="h-full w-full">{children}</div>}
                </div>
                {summary && !loading && !error && !empty && <p className="sr-only">{summary}</p>}
            </CardContent>
        </Card>
    );
}

interface TrendProps {
    data: Record<string, any>[];
    xKey: string;
    series: Series[];
    kind?: 'line' | 'area' | 'bar';
    /** Days from this x value onward are drawn shaded (upcoming days) */
    shadeFrom?: string;
    stacked?: boolean;
}

/** Line, area or bar chart over a list of days, with consistent axes, grid and tooltip. */
export function TrendChart({ data, xKey, series, kind = 'line', shadeFrom, stacked }: TrendProps) {
    const color = (s: Series, i: number) => s.color ?? PALETTE[i % PALETTE.length];
    const hasRight = series.some((s) => s.right);
    const leftKind = series.find((s) => !s.right)?.kind ?? 'number';
    const rightKind = series.find((s) => s.right)?.kind ?? 'number';
    const common = { data, margin: { top: 5, right: hasRight ? 5 : 16, bottom: 0, left: 0 } };
    const axes = (
        <>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_COLORS.grid} />
            <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: CHART_COLORS.axis }} interval="preserveStartEnd" minTickGap={16} />
            <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: CHART_COLORS.axis }} width={leftKind === 'money' ? 64 : 32} allowDecimals={false}
                tickFormatter={(v) => formatAxis(Number(v), leftKind)} />
            {hasRight && <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: CHART_COLORS.axis }} width={rightKind === 'money' ? 64 : 32} allowDecimals={false}
                tickFormatter={(v) => formatAxis(Number(v), rightKind)} />}
            <Tooltip content={<ChartTooltip series={series} />} cursor={{ fill: '#f3f4f6' }} />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {shadeFrom && data.length > 0 && <ReferenceArea yAxisId="left" x1={shadeFrom} x2={data[data.length - 1][xKey]} fill="#f3f4f6" fillOpacity={0.7} />}
        </>
    );
    const axisId = (s: Series) => (s.right ? 'right' : 'left');
    return (
        <ResponsiveContainer width="100%" height="100%">
            {kind === 'bar' ? (
                <BarChart {...common}>{axes}
                    {series.map((s, i) => <Bar key={s.key} yAxisId={axisId(s)} dataKey={s.key} name={s.label} fill={color(s, i)} radius={stacked ? 0 : [4, 4, 0, 0]} maxBarSize={36} stackId={stacked ? 'a' : undefined} />)}
                </BarChart>
            ) : kind === 'area' ? (
                <AreaChart {...common}>{axes}
                    {series.map((s, i) => <Area key={s.key} yAxisId={axisId(s)} type="monotone" dataKey={s.key} name={s.label} stroke={color(s, i)} fill={color(s, i)} fillOpacity={0.15} strokeWidth={2} dot={false} />)}
                </AreaChart>
            ) : (
                <LineChart {...common}>{axes}
                    {series.map((s, i) => <Line key={s.key} yAxisId={axisId(s)} type="monotone" dataKey={s.key} name={s.label} stroke={color(s, i)} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />)}
                </LineChart>
            )}
        </ResponsiveContainer>
    );
}

interface DonutProps {
    data: { name: string; value: number }[];
    kind?: ValueKind;
    colors?: Record<string, string>;
}

/** A ring chart with a legend that carries the numbers (so colour is never the only signal). */
export function DonutBreakdown({ data, kind = 'number', colors }: DonutProps) {
    const shown = data.filter((d) => d.value > 0);
    const total = shown.reduce((n, d) => n + d.value, 0);
    const fill = (d: { name: string }, i: number) => colors?.[d.name] ?? PALETTE[i % PALETTE.length];
    return (
        <div className="flex h-full items-center gap-4">
            <div className="h-full w-[45%] min-w-[120px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={shown} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} strokeWidth={0}>
                            {shown.map((d, i) => <Cell key={d.name} fill={fill(d, i)} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => formatValue(Number(v), kind)} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
                {shown.map((d, i) => (
                    <li key={d.name} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: fill(d, i) }} aria-hidden />
                        <span className="text-neutral-700">{d.name}</span>
                        <span className="ml-auto pl-3 font-medium tabular-nums text-neutral-900">{formatValue(d.value, kind)}{total > 0 && kind === 'number' ? <span className="font-normal text-neutral-500"> ({Math.round((d.value / total) * 100)}%)</span> : null}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** Horizontal bars for a ranked list (top doctors, top medicines). */
export function RankedBars({ data, kind = 'number' }: { data: { name: string; value: number }[]; kind?: ValueKind }) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART_COLORS.grid} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: CHART_COLORS.axis }} allowDecimals={false} tickFormatter={(v) => formatAxis(Number(v), kind)} />
                <YAxis type="category" dataKey="name" width={110} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#374151' }} />
                <Tooltip content={<ChartTooltip series={[{ key: 'value', label: 'Total', kind }]} />} cursor={{ fill: '#f3f4f6' }} />
                <Bar dataKey="value" fill={CHART_COLORS.brand} radius={[0, 4, 4, 0]} maxBarSize={22} />
            </BarChart>
        </ResponsiveContainer>
    );
}

/** "12% more than last month" style badge. */
export function ChangeBadge({ change, goodWhenUp = true }: { change: number | null; goodWhenUp?: boolean }) {
    if (change === null) return <span className="text-xs text-neutral-500">No earlier figure to compare</span>;
    const up = change >= 0;
    const good = up === goodWhenUp;
    return (
        <span className={`text-xs font-medium ${change === 0 ? 'text-neutral-600' : good ? 'text-emerald-700' : 'text-red-700'}`}>
            {up ? '▲' : '▼'} {Math.abs(change)}% vs last month
        </span>
    );
}
