import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Banknote, UserCheck, Calendar } from 'lucide-react';
import { query } from '@/lib/db';
import { formatLKR } from '@/lib/utils';

async function getAdminStats() {
    try {
        const [revenueConfig] = await query<any[]>('SELECT SUM(total_amount) as total FROM bills WHERE status = "PAID"');
        const [patientConfig] = await query<any[]>('SELECT COUNT(*) as count FROM patients');
        const [staffConfig] = await query<any[]>('SELECT COUNT(*) as count FROM users WHERE role IN ("DOCTOR", "PHARMACIST", "LAB_ASSISTANT", "RECEPTIONIST")');
        const [apptConfig] = await query<any[]>('SELECT COUNT(*) as count FROM appointments WHERE  date = CURDATE()');

        return {
            revenue: revenueConfig?.total || 0,
            patients: patientConfig?.count || 0,
            staff: staffConfig?.count || 0,
            todayAppointments: apptConfig?.count || 0
        };
    } catch (error) {
        console.error('Failed to fetch admin stats:', error);
        return { revenue: 0, patients: 0, staff: 0, todayAppointments: 0 };
    }
}

export default async function AdminDashboard() {
    const stats = await getAdminStats();

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>
                <p className="text-neutral-500">Welcome back, Admin. Here's what's happening today.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <Banknote className="h-4 w-4 text-neutral-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatLKR(Number(stats.revenue), { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                        <p className="text-xs text-neutral-500">Lifetime earnings</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
                        <Users className="h-4 w-4 text-neutral-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.patients}</div>
                        <p className="text-xs text-neutral-500">Registered patients</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
                        <UserCheck className="h-4 w-4 text-neutral-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.staff}</div>
                        <p className="text-xs text-neutral-500">Doctors, Pharmacists, etc.</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Today's Appointments</CardTitle>
                        <Calendar className="h-4 w-4 text-neutral-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.todayAppointments}</div>
                        <p className="text-xs text-neutral-500">Scheduled for today</p>
                    </CardContent>
                </Card>
            </div>

            {/* Placeholder for Recent Activity */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Recent Appointments</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-neutral-500">No appointments scheduled recently.</p>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>System Health</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm text-green-600 font-medium">All Systems Operational</div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
