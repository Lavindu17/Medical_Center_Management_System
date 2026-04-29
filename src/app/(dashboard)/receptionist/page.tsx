
import { pool } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, Banknote, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

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
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-neutral-900">Reception Dashboard</h1>
                <p className="text-neutral-500 mt-0.5 text-sm">Today's overview at a glance.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { icon: Calendar,  label: "Today's Appointments", main: stats.appointments.total,    sub: `${stats.appointments.checked_in} checked in / ${stats.appointments.pending} pending`, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { icon: Banknote,  label: 'Pending Bills',         main: stats.billing.pending_count,  sub: `${Number(stats.billing.pending_amount || 0).toFixed(2)} LKR to collect`, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { icon: Clock,     label: 'Completed Today',       main: stats.appointments.completed, sub: 'Patients discharged today', color: 'text-teal-600', bg: 'bg-teal-50' },
                    { icon: Users,     label: 'Quick Actions',         main: null, sub: null, color: 'text-neutral-600', bg: 'bg-neutral-100' },
                ].map((kpi, i) => kpi.main !== null ? (
                    <Card key={kpi.label} className="border border-neutral-200 shadow-none">
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                                <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide leading-tight">{kpi.label}</p>
                                <div className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 ${kpi.bg}`}>
                                    <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                                </div>
                            </div>
                            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.main}</p>
                            <p className="text-xs text-neutral-400 mt-1">{kpi.sub}</p>
                        </CardContent>
                    </Card>
                ) : (
                    <Card key={kpi.label} className="border border-neutral-200 shadow-none">
                        <CardContent className="p-4 flex flex-col gap-2">
                            <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide">Quick Actions</p>
                            <Link href="/receptionist/register" className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 hover:underline font-medium">
                                <ArrowRight className="h-3 w-3" /> Register Patient
                            </Link>
                            <Link href="/receptionist/appointments" className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 hover:underline font-medium">
                                <ArrowRight className="h-3 w-3" /> Check-in Patient
                            </Link>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="p-6 bg-white rounded-xl border border-neutral-200 shadow-none">
                <h3 className="font-semibold mb-2 text-neutral-700">Queue Status</h3>
                <p className="text-neutral-400 text-sm">Doctor queues will appear here once check-ins are processed.</p>
            </div>
        </div>
    );
}
