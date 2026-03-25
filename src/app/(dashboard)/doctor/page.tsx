'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Users, Banknote, Activity } from 'lucide-react';
import { formatLKR } from '@/lib/utils';

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
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            {/* Start Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-neutral-500 mt-2">
                    Welcome back, <span className="font-semibold text-blue-600">{user?.name || 'Doctor'}</span>. Here is your overview.
                </p>
            </div>

            {/* Metrics Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Today's Appointments</CardTitle>
                        <Calendar className="h-4 w-4 text-neutral-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? '-' : stats.todayAppointments}</div>
                        <p className="text-xs text-neutral-500">Scheduled for today</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
                        <Activity className="h-4 w-4 text-neutral-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? '-' : stats.upcomingAppointments}</div>
                        <p className="text-xs text-neutral-500">Future appointments</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
                        <Users className="h-4 w-4 text-neutral-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? '-' : stats.totalPatients}</div>
                        <p className="text-xs text-neutral-500">Unique patients seen</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <Banknote className="h-4 w-4 text-neutral-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? '-' : formatLKR(stats.revenue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                        <p className="text-xs text-neutral-500">From paid bills</p>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions or Recent list placeholder */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[200px] flex items-center justify-center text-neutral-400">
                            Chart Placeholder (Revenue over time)
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {/* Placeholder items */}
                            <div className="flex items-center">
                                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                                <div className="text-sm">
                                    <p className="font-medium">Appointment Completed</p>
                                    <p className="text-xs text-neutral-500">John Doe - 10:00 AM</p>
                                </div>
                            </div>

                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
