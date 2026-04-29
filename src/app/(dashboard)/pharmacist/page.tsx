'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Pill, AlertTriangle, FileText, Activity, TrendingUp, Package, BarChart2 } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { formatLKR } from '@/lib/utils';
import { SkeletonKpiRow } from '@/components/ui/skeleton';
import {
    ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ReTooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
    AreaChart, Area
} from 'recharts';

const THEME = {
    primary:  '#10B981', // emerald-500
    mint:     '#73E6CA', 
    teal:     '#0891B2', 
    emerald:  '#059669', 
    orange:   '#F97316', 
    red:      '#EF4444', 
    slate:    '#94A3B8', 
    neutral:  '#E5E7EB', 
} as const;

const CHART_COLORS = [THEME.primary, THEME.mint, THEME.emerald, THEME.teal, THEME.orange];

function CurrencyTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-neutral-200 rounded-lg shadow-lg px-3 py-2 text-xs">
            <p className="font-semibold text-neutral-700 mb-1">{label}</p>
            {payload.map((p: any) => (
                <p key={p.dataKey} style={{ color: p.color }} className="font-mono">
                    {p.name}: {p.name.includes('Revenue') || p.name.includes('Value') ? formatLKR(p.value) : p.value}
                </p>
            ))}
        </div>
    );
}

export default function PharmacistDashboard() {
    const [stats, setStats] = useState({
        pendingPrescriptions: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        totalMedicines: 0,
        expiredBatchesCount: 0,
        expiringSoonCount: 0
    });
    
    const [chartData, setChartData] = useState<{
        dailyTrend: any[];
        inventory: { assetValue: number; writeOffValue: number };
        categories: { name: string; value: number }[];
    } | null>(null);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch('/api/pharmacist/stats').then(res => res.json()),
            fetch('/api/pharmacist/chart-data').then(res => res.json())
        ])
        .then(([statsData, chartsData]) => {
            setStats(statsData);
            setChartData(chartsData);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }, []);

    const cards = [
        {
            title: 'Pending Prescriptions',
            value: stats.pendingPrescriptions,
            icon: FileText,
            description: 'Require dispensing',
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            href: '/pharmacist/prescriptions'
        },
        {
            title: 'Alerts',
            value: stats.expiredBatchesCount + stats.expiringSoonCount + stats.lowStockCount + stats.outOfStockCount,
            icon: AlertTriangle,
            description: 'Inventory & Expiry warnings',
            color: 'text-red-600',
            bg: 'bg-red-50',
            href: '/pharmacist/alerts'
        },
        {
            title: 'Total Inventory',
            value: stats.totalMedicines,
            icon: Pill,
            description: 'Medicine types registered',
            color: 'text-teal-600',
            bg: 'bg-teal-50',
            href: '/pharmacist/inventory'
        }
    ];

    const inventoryData = chartData ? [
        { name: 'Active Asset Value', value: chartData.inventory.assetValue, fill: THEME.primary },
        { name: 'Expired Write-offs', value: chartData.inventory.writeOffValue, fill: THEME.red }
    ] : [];

    return (
        <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-neutral-900">Pharmacist Dashboard</h1>
                <p className="text-neutral-500 mt-0.5 text-sm">Overview of pharmacy operations and inventory.</p>
            </motion.div>

            {loading ? <SkeletonKpiRow count={3} /> : (
                <div className="grid md:grid-cols-3 gap-4">
                    {cards.map((card, i) => {
                        const isUrgent = (card.title === 'Alerts' && card.value > 0);
                        return (
                            <motion.div key={card.title} className="h-full" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, duration: 0.3 }}>
                                <Link href={card.href} className="block group h-full">
                                    <Card className={`h-full flex flex-col transition-all duration-200 hover:shadow-md border-neutral-100 ${isUrgent ? 'ring-1 ring-red-200' : ''}`}>
                                        <CardContent className="p-4 flex-1 flex flex-col">
                                            <div className="flex items-start justify-between mb-3">
                                                <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide leading-tight">{card.title}</p>
                                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${card.bg}`}>
                                                    <card.icon className={`h-4 w-4 ${card.color} ${isUrgent ? 'animate-pulse' : ''}`} />
                                                </div>
                                            </div>
                                            <div className={`text-3xl font-bold tracking-tight ${card.color}`}>
                                                {card.value}
                                            </div>
                                            <p className="text-xs text-neutral-400 mt-auto pt-1">{card.description}</p>
                                        </CardContent>
                                    </Card>
                                </Link>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {!loading && chartData && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    
                    {/* Daily Trend Area Chart */}
                    <Card className="border border-neutral-100 lg:col-span-2">
                        <CardHeader className="pb-0 pt-4 px-4">
                            <CardTitle className="text-xs font-semibold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-emerald-600" />
                                Dispensing & Revenue Trend (Last 30 Days)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 mt-2">
                            <ResponsiveContainer width="100%" height={240}>
                                <AreaChart data={chartData.dailyTrend}>
                                    <defs>
                                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={THEME.primary} stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor={THEME.primary} stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={THEME.neutral} vertical={false} />
                                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: THEME.slate }} axisLine={false} tickLine={false} interval={5} />
                                    <YAxis yAxisId="left" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: THEME.slate }} axisLine={false} tickLine={false} width={36} />
                                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: THEME.slate }} axisLine={false} tickLine={false} width={24} />
                                    <ReTooltip content={<CurrencyTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: 11, color: THEME.slate }} />
                                    <Area yAxisId="left" type="monotone" dataKey="revenue" name="Revenue (LKR)" stroke={THEME.primary} fill="url(#colorRev)" strokeWidth={2} dot={false} />
                                    <Area yAxisId="right" type="step" dataKey="quantity" name="Units Dispensed" stroke={THEME.slate} fill="none" strokeWidth={1.5} dot={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Inventory & Category Visuals */}
                    <div className="space-y-4">
                        <Card className="border border-neutral-100">
                            <CardHeader className="pb-0 pt-4 px-4">
                                <CardTitle className="text-xs font-semibold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                    <Package className="h-4 w-4 text-emerald-600" />
                                    Inventory Valuation
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 pb-4 mt-2">
                                <ResponsiveContainer width="100%" height={120}>
                                    <BarChart data={inventoryData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                        <XAxis type="number" hide />
                                        <YAxis type="category" dataKey="name" hide />
                                        <ReTooltip cursor={{fill: 'transparent'}} content={<CurrencyTooltip />} />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                                            {inventoryData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                                <div className="space-y-2 mt-2">
                                    {inventoryData.map(item => (
                                        <div key={item.name} className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                                                <span className="text-neutral-600">{item.name}</span>
                                            </div>
                                            <span className="font-mono font-medium text-neutral-800">{formatLKR(item.value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border border-neutral-100">
                            <CardHeader className="pb-0 pt-4 px-4">
                                <CardTitle className="text-xs font-semibold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                    <BarChart2 className="h-4 w-4 text-emerald-600" />
                                    Top Categories (Revenue)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 pb-4 mt-2">
                                {chartData.categories.length === 0 ? (
                                    <div className="h-[140px] flex items-center justify-center text-sm text-neutral-400">No data available</div>
                                ) : (
                                    <>
                                        <ResponsiveContainer width="100%" height={140}>
                                            <PieChart>
                                                <Pie
                                                    data={chartData.categories}
                                                    cx="50%" cy="50%"
                                                    innerRadius={35} outerRadius={60}
                                                    paddingAngle={2}
                                                    dataKey="value"
                                                    strokeWidth={0}
                                                >
                                                    {chartData.categories.map((_, i) => (
                                                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <ReTooltip formatter={(v: any) => formatLKR(Number(v))} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="space-y-1.5 mt-2">
                                            {chartData.categories.slice(0, 3).map((c, i) => (
                                                <div key={c.name} className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                                        <span className="text-neutral-600 truncate max-w-[100px]">{c.name}</span>
                                                    </div>
                                                    <span className="font-mono text-neutral-700">{formatLKR(c.value)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

