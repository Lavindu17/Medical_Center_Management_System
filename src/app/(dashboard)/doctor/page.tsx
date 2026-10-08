'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonKpiRow } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { asDoctor } from '@/lib/names';
import { greeting } from '@/lib/dates';
import { Calendar, Users, Banknote, Activity, Stethoscope, ArrowRight } from 'lucide-react';
import { formatLKR } from '@/lib/utils';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';



/** 500 -> LKR 500, 2500 -> LKR 2.5k, 1,200,000 -> LKR 1.2M */
function compactLKR(value: number) {
    if (!Number.isFinite(value)) return '';
    if (Math.abs(value) >= 1_000_000) return `LKR ${+(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `LKR ${+(value / 1_000).toFixed(1)}k`;
    return `LKR ${value}`;
}

export default function DoctorDashboard() {
    const [stats, setStats] = useState({
        todayAppointments: 0,
        upcomingAppointments: 0,
        totalPatients: 0,
        revenue: 0
    });
    const [chartData, setChartData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        // Fetch User and Stats
        Promise.all([
            fetch('/api/auth/session').then(res => res.json()),
            fetch('/api/doctor/stats').then(res => res.json()),
            fetch('/api/doctor/chart-data').then(res => res.json())
        ]).then(([userData, statsData, chartResData]) => {
            if (userData?.user) setUser(userData.user);
            // Validate statsData before setting
            if (statsData && typeof statsData.revenue === 'number') {
                setStats(statsData);
            } else {
                console.error("Invalid stats data:", statsData);
            }
            if (Array.isArray(chartResData)) {
                setChartData(chartResData);
            }
        }).catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="space-y-6">
            <PageHeader
                title={`${greeting()}, ${asDoctor(user?.name)}`}
                description="Your day at a glance."
                actions={
                    <Button asChild size="lg" className="gap-2">
                        <Link href="/doctor/appointments"><Calendar className="h-4 w-4" aria-hidden /> Today&apos;s appointments</Link>
                    </Button>
                }
            />

            {/* KPI Grid */}
            {loading ? <SkeletonKpiRow count={4} /> : (
                <section aria-label="Overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard label="Today's appointments" value={stats.todayAppointments} hint="Scheduled for today" icon={Calendar} tone="brand" href="/doctor/appointments" />
                    <StatCard label="Upcoming" value={stats.upcomingAppointments} hint="Future appointments" icon={Activity} tone="info" href="/doctor/appointments" />
                    <StatCard label="Patients seen" value={stats.totalPatients} hint="Patients with a completed visit" icon={Users} tone="neutral" href="/doctor/patients" />
                    <StatCard label="Revenue" value={formatLKR(stats.revenue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} hint="From paid bills" icon={Banknote} tone="brand" href="/doctor/earnings" />
                </section>
            )}

            {/* Charts Section */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border border-neutral-200 shadow-none">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold text-neutral-800">Weekly Appointments</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        itemStyle={{ color: '#059669', fontWeight: 600 }}
                                    />
                                    <Line type="monotone" dataKey="appointments" stroke="#059669" strokeWidth={3} dot={{ r: 4, fill: '#059669', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border border-neutral-200 shadow-none">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold text-neutral-800">Revenue Trends</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(value) => compactLKR(Number(value))} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value) => [formatLKR(Number(value ?? 0)), 'Revenue']}
                                        cursor={{ fill: '#f3f4f6' }}
                                    />
                                    <Bar dataKey="revenue" fill="#0d9488" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Quick Actions */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>
                <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Quick Actions</h2>
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { label: "Today's Appointments", href: '/doctor/appointments', icon: Calendar },
                        { label: 'My Patients',           href: '/doctor/patients',     icon: Users },
                    ].map((action) => (
                        <Button key={action.href} asChild variant="outline" className="h-14 gap-3 justify-start border-neutral-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all duration-200">
                            <Link href={action.href}>
                                <action.icon className="h-4 w-4 text-emerald-600" />
                                <span className="text-sm font-medium">{action.label}</span>
                                <ArrowRight className="h-3 w-3 ml-auto text-neutral-400" />
                            </Link>
                        </Button>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}
