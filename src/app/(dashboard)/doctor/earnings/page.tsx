'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatLKR } from '@/lib/utils';
import { Banknote, TrendingDown, TrendingUp, Calendar, CheckCircle } from 'lucide-react';

type Period = 'daily' | 'weekly' | 'monthly' | 'all';

export default function DoctorEarningsPage() {
    const [period, setPeriod] = useState<Period>('monthly');
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/doctor/earnings?period=${period}`)
            .then(res => res.json())
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [period]);

    const periods: { key: Period; label: string }[] = [
        { key: 'daily', label: 'Today' },
        { key: 'weekly', label: 'This Week' },
        { key: 'monthly', label: 'This Month' },
        { key: 'all', label: 'All Time' },
    ];

    const s = data?.summary;

    return (
        <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">Earnings</h1>
                    <p className="text-sm text-neutral-500 mt-1">
                        Your net earnings after the medical centre commission.
                    </p>
                </div>
                {/* Period Tabs */}
                <div className="flex bg-neutral-100 rounded-lg p-1 gap-1">
                    {periods.map(p => (
                        <button
                            key={p.key}
                            onClick={() => setPeriod(p.key)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${period === p.key
                                ? 'bg-white text-neutral-900 shadow-sm'
                                : 'text-neutral-500 hover:text-neutral-700'
                                }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="text-neutral-500 text-sm">Loading earnings...</div>
            ) : !data || !data.summary ? (
                <div className="text-red-500 text-sm">{data?.message || 'Failed to load data.'}</div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="border-emerald-100 bg-emerald-50/50">
                            <CardHeader className="pb-2 pt-4 px-4">
                                <CardTitle className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Net Earnings</CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 pb-4">
                                <div className="text-2xl font-bold text-emerald-700">{formatLKR(s.net_earnings)}</div>
                                <p className="text-xs text-neutral-500 mt-0.5">After {data.commission_rate}% commission</p>
                            </CardContent>
                        </Card>

                        <Card className="border-blue-100 bg-blue-50/50">
                            <CardHeader className="pb-2 pt-4 px-4">
                                <CardTitle className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Gross Billed</CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 pb-4">
                                <div className="text-2xl font-bold text-blue-700">{formatLKR(s.gross_earned)}</div>
                                <p className="text-xs text-neutral-500 mt-0.5">Charged to patients</p>
                            </CardContent>
                        </Card>

                        <Card className="border-red-100 bg-red-50/50">
                            <CardHeader className="pb-2 pt-4 px-4">
                                <CardTitle className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Commission Paid</CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 pb-4">
                                <div className="text-2xl font-bold text-red-600">{formatLKR(s.center_commission)}</div>
                                <p className="text-xs text-neutral-500 mt-0.5">{data.commission_rate}% to medical center</p>
                            </CardContent>
                        </Card>

                        <Card className="border-neutral-200 bg-neutral-50/50">
                            <CardHeader className="pb-2 pt-4 px-4">
                                <CardTitle className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Appointments</CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 pb-4">
                                <div className="text-2xl font-bold text-neutral-800">{s.total_appointments}</div>
                                <p className="text-xs text-neutral-500 mt-0.5">Completed & paid</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Earnings Breakdown Bar */}
                    {s.gross_earned > 0 && (
                        <Card>
                            <CardContent className="pt-4 pb-4">
                                <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
                                    <span>Gross Billed = Net Earnings + Commission</span>
                                    <span>{formatLKR(s.gross_earned)}</span>
                                </div>
                                <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
                                    <div
                                        className="bg-emerald-500 transition-all"
                                        style={{ width: `${(s.net_earnings / s.gross_earned) * 100}%` }}
                                        title={`Net: ${formatLKR(s.net_earnings)}`}
                                    />
                                    <div
                                        className="bg-red-400 transition-all"
                                        style={{ width: `${(s.center_commission / s.gross_earned) * 100}%` }}
                                        title={`Commission: ${formatLKR(s.center_commission)}`}
                                    />
                                </div>
                                <div className="flex gap-4 mt-2">
                                    <span className="flex items-center gap-1.5 text-xs text-neutral-500"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Net Earnings</span>
                                    <span className="flex items-center gap-1.5 text-xs text-neutral-500"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> Commission</span>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Per-Appointment Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Appointment Breakdown</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {data.appointments.length === 0 ? (
                                <p className="text-sm text-neutral-400 text-center py-8">No completed appointments in this period.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-neutral-50 border-b text-neutral-500 font-semibold text-xs uppercase">
                                            <tr>
                                                <th className="p-3 text-left">Date</th>
                                                <th className="p-3 text-left">Patient</th>
                                                <th className="p-3 text-right">Gross Fee</th>
                                                <th className="p-3 text-right">Commission</th>
                                                <th className="p-3 text-right text-emerald-700">Net Earned</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {data.appointments.map((appt: any, i: number) => (
                                                <tr key={i} className="hover:bg-neutral-50 transition-colors">
                                                    <td className="p-3 text-neutral-500">
                                                        {new Date(appt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </td>
                                                    <td className="p-3 font-medium text-neutral-800">{appt.patient_name}</td>
                                                    <td className="p-3 text-right text-neutral-600">{formatLKR(appt.doctor_fee)}</td>
                                                    <td className="p-3 text-right text-red-500">- {formatLKR(appt.commission_amount)}</td>
                                                    <td className="p-3 text-right font-bold text-emerald-700">{formatLKR(appt.net_earned)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-neutral-50 border-t font-semibold">
                                            <tr>
                                                <td colSpan={2} className="p-3 text-neutral-700">Total ({s.total_appointments} appointments)</td>
                                                <td className="p-3 text-right text-neutral-600">{formatLKR(s.gross_earned)}</td>
                                                <td className="p-3 text-right text-red-500">- {formatLKR(s.center_commission)}</td>
                                                <td className="p-3 text-right text-emerald-700">{formatLKR(s.net_earnings)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
