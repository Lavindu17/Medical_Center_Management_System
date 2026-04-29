'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package, Calendar, TrendingUp, PieChart as PieChartIcon, BarChart2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { SkeletonKpiRow } from '@/components/ui/skeleton';
import {
    ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ReTooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';

const ALERT_COLORS = {
    expired: '#EF4444',      // red-500
    expiringSoon: '#F59E0B', // amber-500
    expiringLater: '#EAB308',// yellow-500
    multiBatch: '#3B82F6',   // blue-500
    lowStock: '#F97316',     // orange-500
    neutral: '#E5E7EB'
};

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-neutral-200 rounded-lg shadow-lg px-3 py-2 text-xs">
            <p className="font-semibold text-neutral-700 mb-1">{label}</p>
            {payload.map((p: any) => (
                <p key={p.dataKey} style={{ color: p.color || p.fill }} className="font-mono">
                    {p.name}: {p.value}
                </p>
            ))}
        </div>
    );
}

export default function ExpiryAlertsPage() {
    const [alerts, setAlerts] = useState<any>({
        expired: [],
        expiringSoon: [],
        expiringLater: [],
        multiBatchWarnings: [],
        lowStock: [],
        summary: {
            expiredCount: 0,
            expiringSoonCount: 0,
            expiringLaterCount: 0,
            multiBatchWarningsCount: 0,
            lowStockCount: 0
        }
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/pharmacist/alerts')
            .then(res => res.json())
            .then(data => setAlerts(data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (loading) return (
        <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-neutral-900">Expiry Alerts</h1>
            <SkeletonKpiRow count={4} />
        </div>
    );

    const sum = alerts.summary;
    const totalAlerts = sum.expiredCount + sum.expiringSoonCount + sum.expiringLaterCount + sum.lowStockCount;

    const pieData = [
        { name: 'Expired', value: sum.expiredCount, fill: ALERT_COLORS.expired },
        { name: 'Expiring Soon', value: sum.expiringSoonCount, fill: ALERT_COLORS.expiringSoon },
        { name: 'Expiring Later', value: sum.expiringLaterCount, fill: ALERT_COLORS.expiringLater },
        { name: 'Low Stock', value: sum.lowStockCount, fill: ALERT_COLORS.lowStock },
    ].filter(d => d.value > 0);

    const lowStockChartData = alerts.lowStock.slice(0, 5).map((med: any) => ({
        name: med.medicine_name.length > 15 ? med.medicine_name.substring(0, 15) + '...' : med.medicine_name,
        current: med.current_stock,
        minimum: med.min_stock_level,
    }));

    return (
        <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-8">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-neutral-900">Expiry & Stock Alerts</h1>
                <p className="text-neutral-500 mt-0.5 text-sm">Monitor batch expiries and inventory shortages.</p>
            </motion.div>

            {/* Top Visuals Section */}
            <div className="grid lg:grid-cols-3 gap-6">
                
                {/* KPI Cards */}
                <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Card className="border border-red-200 bg-red-50/50 hover:bg-red-50 transition-colors">
                        <CardContent className="p-4 flex items-start gap-3">
                            <div className="p-2 bg-red-100 rounded-lg"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
                            <div>
                                <p className="text-2xl font-bold text-red-700 leading-none">{sum.expiredCount}</p>
                                <p className="text-xs text-red-600 mt-1 font-medium uppercase tracking-wider">Expired</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border border-amber-200 bg-amber-50/50 hover:bg-amber-50 transition-colors">
                        <CardContent className="p-4 flex items-start gap-3">
                            <div className="p-2 bg-amber-100 rounded-lg"><Calendar className="h-5 w-5 text-amber-600" /></div>
                            <div>
                                <p className="text-2xl font-bold text-amber-700 leading-none">{sum.expiringSoonCount}</p>
                                <p className="text-xs text-amber-600 mt-1 font-medium uppercase tracking-wider">Soon (30d)</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border border-orange-200 bg-orange-50/50 hover:bg-orange-50 transition-colors">
                        <CardContent className="p-4 flex items-start gap-3">
                            <div className="p-2 bg-orange-100 rounded-lg"><Package className="h-5 w-5 text-orange-600" /></div>
                            <div>
                                <p className="text-2xl font-bold text-orange-700 leading-none">{sum.lowStockCount}</p>
                                <p className="text-xs text-orange-600 mt-1 font-medium uppercase tracking-wider">Low Stock</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border border-yellow-200 bg-yellow-50/50 hover:bg-yellow-50 transition-colors">
                        <CardContent className="p-4 flex items-start gap-3">
                            <div className="p-2 bg-yellow-100 rounded-lg"><Calendar className="h-5 w-5 text-yellow-600" /></div>
                            <div>
                                <p className="text-2xl font-bold text-yellow-700 leading-none">{sum.expiringLaterCount}</p>
                                <p className="text-xs text-yellow-600 mt-1 font-medium uppercase tracking-wider">Later (90d)</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border border-blue-200 bg-blue-50/50 hover:bg-blue-50 transition-colors">
                        <CardContent className="p-4 flex items-start gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg"><TrendingUp className="h-5 w-5 text-blue-600" /></div>
                            <div>
                                <p className="text-2xl font-bold text-blue-700 leading-none">{sum.multiBatchWarningsCount}</p>
                                <p className="text-xs text-blue-600 mt-1 font-medium uppercase tracking-wider">Multi-Batch</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Pie Chart Summary */}
                <Card className="border border-neutral-100 shadow-sm">
                    <CardHeader className="pb-0 pt-4 px-4">
                        <CardTitle className="text-xs font-semibold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                            <PieChartIcon className="h-4 w-4 text-emerald-600" />
                            Alert Distribution
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                        {totalAlerts === 0 ? (
                            <div className="h-[140px] flex items-center justify-center text-sm text-neutral-400">All clear! No active alerts.</div>
                        ) : (
                            <div className="flex items-center">
                                <div className="w-1/2">
                                    <ResponsiveContainer width="100%" height={140}>
                                        <PieChart>
                                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value" strokeWidth={0}>
                                                {pieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))}
                                            </Pie>
                                            <ReTooltip content={<CustomTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="w-1/2 space-y-2">
                                    {pieData.map(d => (
                                        <div key={d.name} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }} />
                                                <span className="text-neutral-600">{d.name}</span>
                                            </div>
                                            <span className="font-medium text-neutral-800">{d.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Low Stock Bar Chart */}
            {alerts.lowStock.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <Card className="border border-neutral-100 shadow-sm">
                        <CardHeader className="pb-0 pt-4 px-4">
                            <CardTitle className="text-xs font-semibold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                <BarChart2 className="h-4 w-4 text-emerald-600" />
                                Critical Low Stock Levels (Top 5)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 mt-4">
                            <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={lowStockChartData} barCategoryGap="20%">
                                    <CartesianGrid strokeDasharray="3 3" stroke={ALERT_COLORS.neutral} vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} width={30} />
                                    <ReTooltip content={<CustomTooltip />} cursor={{ fill: '#F3F4F6' }} />
                                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: '10px' }} />
                                    <Bar dataKey="current" name="Current Stock" fill={ALERT_COLORS.lowStock} radius={[3,3,0,0]} />
                                    <Bar dataKey="minimum" name="Min Required" fill={ALERT_COLORS.neutral} radius={[3,3,0,0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {/* Detailed Tabs */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                <Tabs defaultValue={sum.expiredCount > 0 ? "expired" : sum.lowStockCount > 0 ? "lowstock" : sum.expiringSoonCount > 0 ? "soon" : "later"} className="w-full">
                    <TabsList className="flex flex-wrap gap-2 h-auto bg-transparent mb-4">
                        <TabsTrigger value="expired" className="data-[state=active]:bg-red-50 data-[state=active]:text-red-700 data-[state=active]:border-red-200 border border-transparent">
                            Expired <Badge variant="secondary" className="ml-2 bg-white text-red-600">{sum.expiredCount}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="soon" className="data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 data-[state=active]:border-amber-200 border border-transparent">
                            Soon <Badge variant="secondary" className="ml-2 bg-white text-amber-600">{sum.expiringSoonCount}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="lowstock" className="data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 data-[state=active]:border-orange-200 border border-transparent">
                            Low Stock <Badge variant="secondary" className="ml-2 bg-white text-orange-600">{sum.lowStockCount}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="multi" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200 border border-transparent">
                            Multi-Batch <Badge variant="secondary" className="ml-2 bg-white text-blue-600">{sum.multiBatchWarningsCount}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="later" className="data-[state=active]:bg-yellow-50 data-[state=active]:text-yellow-700 data-[state=active]:border-yellow-200 border border-transparent">
                            Later <Badge variant="secondary" className="ml-2 bg-white text-yellow-600">{sum.expiringLaterCount}</Badge>
                        </TabsTrigger>
                    </TabsList>

                    {/* Expired Batches */}
                    <TabsContent value="expired" className="mt-0 outline-none">
                        <Card className="border-red-200 shadow-sm">
                            <CardHeader className="bg-red-50/50 border-b border-red-100 pb-4">
                                <CardTitle className="text-red-900 text-sm flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4" /> Expired Batches - Action Required
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {alerts.expired.length === 0 ? (
                                    <p className="text-center text-neutral-500 py-8 text-sm">No expired batches. Great job!</p>
                                ) : (
                                    <div className="divide-y divide-red-100">
                                        {alerts.expired.map((batch: any) => (
                                            <div key={batch.batch_id} className="p-4 hover:bg-red-50/30 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h3 className="font-semibold text-neutral-900">{batch.medicine_name}</h3>
                                                        <p className="text-xs text-neutral-500 font-mono mt-0.5">Batch: {batch.batch_number}</p>
                                                    </div>
                                                    <Badge variant="destructive" className="bg-red-500">Expired</Badge>
                                                </div>
                                                <div className="flex gap-4 text-xs">
                                                    <span className="text-neutral-500">Date: {formatDate(batch.expiry_date)}</span>
                                                    <span className="text-red-600 font-semibold">{batch.days_expired} days ago</span>
                                                    <span className="text-neutral-700 font-medium bg-red-100 px-2 py-0.5 rounded-full">{batch.quantity_current} {batch.unit}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Expiring Soon */}
                    <TabsContent value="soon" className="mt-0 outline-none">
                        <Card className="border-amber-200 shadow-sm">
                            <CardHeader className="bg-amber-50/50 border-b border-amber-100 pb-4">
                                <CardTitle className="text-amber-900 text-sm flex items-center gap-2">
                                    <Calendar className="h-4 w-4" /> Expiring Within 30 Days
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {alerts.expiringSoon.length === 0 ? (
                                    <p className="text-center text-neutral-500 py-8 text-sm">No batches expiring soon.</p>
                                ) : (
                                    <div className="divide-y divide-amber-100">
                                        {alerts.expiringSoon.map((batch: any) => (
                                            <div key={batch.batch_id} className="p-4 hover:bg-amber-50/30 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h3 className="font-semibold text-neutral-900">{batch.medicine_name}</h3>
                                                        <p className="text-xs text-neutral-500 font-mono mt-0.5">Batch: {batch.batch_number}</p>
                                                    </div>
                                                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200">Expiring Soon</Badge>
                                                </div>
                                                <div className="flex gap-4 text-xs">
                                                    <span className="text-neutral-500">Date: {formatDate(batch.expiry_date)}</span>
                                                    <span className="text-amber-600 font-semibold">{batch.days_until_expiry} days left</span>
                                                    <span className="text-neutral-700 font-medium bg-amber-100 px-2 py-0.5 rounded-full">{batch.quantity_current} {batch.unit}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Low Stock */}
                    <TabsContent value="lowstock" className="mt-0 outline-none">
                        <Card className="border-orange-200 shadow-sm">
                            <CardHeader className="bg-orange-50/50 border-b border-orange-100 pb-4">
                                <CardTitle className="text-orange-900 text-sm flex items-center gap-2">
                                    <Package className="h-4 w-4" /> Critical Low Stock Items
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {alerts.lowStock.length === 0 ? (
                                    <p className="text-center text-neutral-500 py-8 text-sm">All items well stocked.</p>
                                ) : (
                                    <div className="divide-y divide-orange-100">
                                        {alerts.lowStock.map((med: any) => (
                                            <div key={med.medicine_id} className="p-4 hover:bg-orange-50/30 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h3 className="font-semibold text-neutral-900">{med.medicine_name}</h3>
                                                        <div className="flex gap-2 mt-1">
                                                            {med.generic_name && <span className="text-xs text-neutral-500">{med.generic_name}</span>}
                                                            {med.category && <span className="text-[10px] uppercase bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">{med.category}</span>}
                                                        </div>
                                                    </div>
                                                    <Badge variant="outline" className="text-orange-600 border-orange-300">Reorder</Badge>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs mt-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-neutral-500 uppercase text-[10px] tracking-wider">Current</span>
                                                        <span className={`font-semibold text-lg leading-none mt-0.5 ${med.current_stock === 0 ? 'text-red-600' : 'text-orange-600'}`}>
                                                            {med.current_stock}
                                                        </span>
                                                    </div>
                                                    <div className="w-px h-6 bg-orange-200" />
                                                    <div className="flex flex-col">
                                                        <span className="text-neutral-500 uppercase text-[10px] tracking-wider">Minimum</span>
                                                        <span className="font-semibold text-lg leading-none text-neutral-700 mt-0.5">
                                                            {med.min_stock_level}
                                                        </span>
                                                    </div>
                                                    <div className="ml-auto text-orange-600 font-medium">
                                                        {med.current_stock === 0 ? 'OUT OF STOCK' : `Need ${med.min_stock_level - med.current_stock} units`}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Multi-Batch Warnings */}
                    <TabsContent value="multi" className="mt-0 outline-none">
                        <Card className="border-blue-200 shadow-sm">
                            <CardHeader className="bg-blue-50/50 border-b border-blue-100 pb-4">
                                <CardTitle className="text-blue-900 text-sm flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4" /> FEFO Dispensing Warnings
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {alerts.multiBatchWarnings.length === 0 ? (
                                    <p className="text-center text-neutral-500 py-8 text-sm">No multi-batch warnings.</p>
                                ) : (
                                    <div className="divide-y divide-blue-100">
                                        {alerts.multiBatchWarnings.map((med: any) => (
                                            <div key={med.medicine_id} className="p-4 hover:bg-blue-50/30 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h3 className="font-semibold text-neutral-900">{med.medicine_name}</h3>
                                                        <p className="text-xs text-neutral-600 mt-0.5">{med.batch_count} active batches</p>
                                                    </div>
                                                    <Badge className="bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200">
                                                        {med.expiry_gap_days} day gap
                                                    </Badge>
                                                </div>
                                                <div className="flex flex-wrap gap-4 text-xs mt-3 bg-white p-3 rounded-md border border-blue-100">
                                                    <div className="flex flex-col">
                                                        <span className="text-neutral-500 uppercase text-[10px]">Earliest</span>
                                                        <span className="font-medium text-neutral-800">{formatDate(med.earliest_expiry)}</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-neutral-500 uppercase text-[10px]">Latest</span>
                                                        <span className="font-medium text-neutral-800">{formatDate(med.latest_expiry)}</span>
                                                    </div>
                                                    <div className="flex flex-col ml-auto text-right">
                                                        <span className="text-blue-600/70 uppercase text-[10px]">Total Stock</span>
                                                        <span className="font-bold text-blue-700">{med.total_stock}</span>
                                                    </div>
                                                </div>
                                                <p className="mt-2 text-[10px] font-medium text-blue-600 uppercase tracking-wider">
                                                    ⚠️ Dispense from earliest expiring batch first
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Expiring Later */}
                    <TabsContent value="later" className="mt-0 outline-none">
                        <Card className="border-yellow-200 shadow-sm">
                            <CardHeader className="bg-yellow-50/50 border-b border-yellow-100 pb-4">
                                <CardTitle className="text-yellow-900 text-sm flex items-center gap-2">
                                    <Calendar className="h-4 w-4" /> Expiring in 31-90 Days
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {alerts.expiringLater.length === 0 ? (
                                    <p className="text-center text-neutral-500 py-8 text-sm">No batches in this range.</p>
                                ) : (
                                    <div className="divide-y divide-yellow-100">
                                        {alerts.expiringLater.map((batch: any) => (
                                            <div key={batch.batch_id} className="p-4 hover:bg-yellow-50/30 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h3 className="font-semibold text-neutral-900">{batch.medicine_name}</h3>
                                                        <p className="text-xs text-neutral-500 font-mono mt-0.5">Batch: {batch.batch_number}</p>
                                                    </div>
                                                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200">Monitor</Badge>
                                                </div>
                                                <div className="flex gap-4 text-xs mt-2">
                                                    <span className="text-neutral-500">Date: {formatDate(batch.expiry_date)}</span>
                                                    <span className="text-yellow-600 font-semibold">{batch.days_until_expiry} days left</span>
                                                    <span className="text-neutral-700 font-medium bg-yellow-100 px-2 py-0.5 rounded-full">{batch.quantity_current} {batch.unit}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                </Tabs>
            </motion.div>
        </div>
    );
}
