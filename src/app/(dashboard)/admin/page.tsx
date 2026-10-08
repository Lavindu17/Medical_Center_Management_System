'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Banknote, UserCheck, Calendar, Activity } from 'lucide-react';
import { formatLKR } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState, ErrorState } from '@/components/ui/state-views';
import { SkeletonKpiRow } from '@/components/ui/skeleton';


export default function AdminDashboard() {
    const [stats, setStats] = useState({ revenue: 0, patients: 0, staff: 0, todayAppointments: 0 });
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);

    const load = () => {
        setLoading(true);
        setFailed(false);
        fetch('/api/admin/dashboard-stats')
            .then(async (res) => {
                if (!res.ok) throw new Error(`dashboard-stats responded ${res.status}`);
                setStats(await res.json());
            })
            .catch((e) => { console.error(e); setFailed(true); })
            .finally(() => setLoading(false));
    };
    useEffect(load, []);

    return (
        <div className="space-y-6">
            <PageHeader title="Admin Dashboard" description="System overview and key performance indicators." />

            {loading ? <SkeletonKpiRow count={4} /> : failed ? (
                <ErrorState title="Could not load the dashboard figures" onRetry={load} />
            ) : (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard label="Total revenue" value={formatLKR(stats.revenue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} hint="Lifetime earnings" icon={Banknote} href="/admin/revenue" />
                    <StatCard label="Total patients" value={stats.patients} hint="Registered patients" icon={Users} tone="info" />
                    <StatCard label="Active staff" value={stats.staff} hint="Doctors, pharmacists and others" icon={UserCheck} tone="neutral" href="/admin/users" />
                    <StatCard label="Today's appointments" value={stats.todayAppointments} hint="Scheduled for today" icon={Calendar} />
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4 border-neutral-200 shadow-[var(--shadow-card)]">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold text-neutral-900">Recent appointments</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <EmptyState
                            icon={Calendar}
                            title="Nothing to show yet"
                            description="Recent appointments will be listed here once there is activity."
                            className="border-0 py-8"
                        />
                    </CardContent>
                </Card>
                <Card className="col-span-3 border-neutral-200 shadow-[var(--shadow-card)]">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base font-semibold text-neutral-900">
                            <Activity className="h-4 w-4 text-emerald-700" aria-hidden /> System health
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                            <span className="h-2 w-2 rounded-full bg-emerald-600" aria-hidden /> All systems operational
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
