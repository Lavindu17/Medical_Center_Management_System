'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Banknote, UserCheck, Calendar, Activity } from 'lucide-react';
import { formatLKR } from '@/lib/utils';
import { motion } from 'framer-motion';
import { SkeletonKpiRow } from '@/components/ui/skeleton';


export default function AdminDashboard() {
    const [stats, setStats] = useState({ revenue: 0, patients: 0, staff: 0, todayAppointments: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // We simulate fetch here or we can call an API endpoint.
        // Assuming we need to fetch via a new endpoint or existing.
        fetch('/api/admin/dashboard-stats')
            .then(res => res.json())
            .then(data => setStats(data))
            .catch(() => setStats({ revenue: 0, patients: 0, staff: 0, todayAppointments: 0 }))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-neutral-900">Admin Dashboard</h1>
                <p className="text-neutral-500 mt-0.5 text-sm">System overview and key performance indicators.</p>
            </motion.div>

            {loading ? <SkeletonKpiRow count={4} /> : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                        { icon: Banknote,  label: 'Total Revenue', value: formatLKR(stats.revenue, { minimumFractionDigits: 0, maximumFractionDigits: 0 }), sub: 'Lifetime earnings', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        { icon: Users,     label: 'Total Patients', value: stats.patients, sub: 'Registered patients', color: 'text-teal-600', bg: 'bg-teal-50' },
                        { icon: UserCheck, label: 'Active Staff', value: stats.staff, sub: 'Doctors, Pharmacists, etc.', color: 'text-neutral-600', bg: 'bg-neutral-100' },
                        { icon: Calendar,  label: 'Today appointments', value: stats.todayAppointments, sub: 'Scheduled for today', color: 'text-emerald-600', bg: 'bg-emerald-50' },
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

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4 border-neutral-200 shadow-none">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold text-neutral-900">Recent Appointments</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-neutral-500">No appointments scheduled recently.</p>
                    </CardContent>
                </Card>
                <Card className="col-span-3 border-neutral-200 shadow-none">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold text-neutral-900 flex items-center gap-2">
                            <Activity className="h-4 w-4 text-emerald-600" /> System Health
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm text-emerald-600 font-medium flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> All Systems Operational
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
