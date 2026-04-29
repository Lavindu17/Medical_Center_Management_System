'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonKpiRow } from '@/components/ui/skeleton';
import { Calendar, Users, Banknote, Activity, Stethoscope, ArrowRight } from 'lucide-react';
import { formatLKR } from '@/lib/utils';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DoctorDashboard() {
    const [stats, setStats] = useState({
        todayAppointments: 0,
        upcomingAppointments: 0,
        totalPatients: 0,
        revenue: 0
    });
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        // Fetch User and Stats
        Promise.all([
            fetch('/api/auth/session').then(res => res.json()),
            fetch('/api/doctor/stats').then(res => res.json())
        ]).then(([userData, statsData]) => {
            if (userData?.user) setUser(userData.user);
            // Validate statsData before setting
            if (statsData && typeof statsData.revenue === 'number') {
                setStats(statsData);
            } else {
                console.error("Invalid stats data:", statsData);
            }
        }).catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-neutral-900">Dashboard</h1>
                <p className="text-neutral-500 mt-0.5 text-sm">
                    Welcome back, <span className="font-semibold text-emerald-600">{user?.name || 'Doctor'}</span>.
                </p>
            </motion.div>

            {/* KPI Grid */}
            {loading ? <SkeletonKpiRow count={4} /> : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                        { icon: Calendar,  label: "Today's Appointments", value: stats.todayAppointments,    sub: 'Scheduled for today',   color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        { icon: Activity,  label: 'Upcoming',              value: stats.upcomingAppointments, sub: 'Future appointments',   color: 'text-teal-600',    bg: 'bg-teal-50' },
                        { icon: Users,     label: 'Total Patients',         value: stats.totalPatients,        sub: 'Unique patients seen',  color: 'text-neutral-600', bg: 'bg-neutral-100' },
                        { icon: Banknote,  label: 'Total Revenue',          value: formatLKR(stats.revenue, { minimumFractionDigits: 0, maximumFractionDigits: 0 }), sub: 'From paid bills', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    ].map((kpi, i) => (
                        <motion.div key={kpi.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, duration: 0.3 }}>
                            <Card className="border border-neutral-200 shadow-none">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide leading-tight">{kpi.label}</p>
                                        <div className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 ${kpi.bg}`}>
                                            <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                                        </div>
                                    </div>
                                    <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                                    <p className="text-xs text-neutral-400 mt-1">{kpi.sub}</p>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Quick Actions */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
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
