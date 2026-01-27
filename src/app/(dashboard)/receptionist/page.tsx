
import { pool } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, DollarSign, Clock } from 'lucide-react';
import Link from 'next/link';

async function getStats() {
    const today = new Date().toISOString().split('T')[0];

    const [apptStats]: any = await pool.query(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'CHECKED_IN' THEN 1 ELSE 0 END) as checked_in,
            SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
        FROM appointments 
        WHERE date = ?
    `, [today]);

    const [billStats]: any = await pool.query(`
        SELECT 
            COUNT(*) as pending_count,
            SUM(total_amount) as pending_amount
        FROM bills 
        WHERE status = 'PENDING'
    `);

    return {
        appointments: apptStats[0],
        billing: billStats[0]
    };
}

export default async function ReceptionistDashboard() {
    const stats = await getStats();

    return (
        <div className="p-8 space-y-8">
            <h1 className="text-3xl font-bold text-neutral-900">Reception Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Today's Appointments</CardTitle>
                        <Calendar className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.appointments.total}</div>
                        <p className="text-xs text-neutral-500">{stats.appointments.checked_in} Checked In / {stats.appointments.pending} Pending</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Bills</CardTitle>
                        <DollarSign className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.billing.pending_count}</div>
                        <p className="text-xs text-neutral-500">${Number(stats.billing.pending_amount || 0).toFixed(2)} to collect</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
                        <Users className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent className="grid gap-2">
                        <Link href="/receptionist/register" className="text-sm text-blue-600 hover:underline">Register New Patient</Link>
                        <Link href="/receptionist/appointments" className="text-sm text-blue-600 hover:underline">Check-in Patient</Link>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Completed</CardTitle>
                        <Clock className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.appointments.completed}</div>
                        <p className="text-xs text-neutral-500">Patients discharged today</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* We can add lists here later */}
                <div className="p-6 bg-white rounded-xl border shadow-sm">
                    <h3 className="font-semibold mb-4">Queues Status</h3>
                    <p className="text-neutral-500 text-sm">Doctor queues will appear here.</p>
                </div>
            </div>
        </div>
    );
}
