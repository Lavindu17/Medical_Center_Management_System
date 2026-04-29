'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatLKR } from '@/lib/utils';
import {
    Banknote, TrendingUp, TrendingDown, Package, Pill,
    FlaskConical, Stethoscope, AlertTriangle, ChevronDown,
    BarChart2, Activity, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/* ── Types ───────────────────────────────────────────────────── */
interface DailyEntry { date: string; gross_revenue: number; patient_billed: number; }
interface FinancialData {
    revenue: { service_charges: number; doctor_commissions: number; lab_revenue: number; pharmacy_revenue: number; gross_revenue: number; };
    cogs: { medicine_cogs: number; lab_cogs: number; total_cogs: number; };
    inventory: { asset_value: number; write_off_value: number; };
    profit: { total_doctor_payouts: number; true_gross_profit: number; };
    doctor_payouts: any[];
    daily: { date: string; gross_revenue: number; patient_billed: number; }[];
    monthly: { 
        month: string; 
        service_charges: number;
        doctor_commissions: number;
        lab_revenue: number;
        pharmacy_revenue: number;
        gross_revenue: number; 
        patient_billed: number; 
    }[];
}

function MetricCard({ title, value, subtitle, icon: Icon, color }: 'blue' | 'emerald' | 'rose' | 'slate' | any) {
    const colors: any = {
        blue: 'bg-blue-50 text-blue-600 ring-blue-100',
        emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
        rose: 'bg-rose-50 text-rose-600 ring-rose-100',
        slate: 'bg-slate-50 text-slate-600 ring-slate-100',
    };
    return (
        <Card className="border-none shadow-sm ring-1 ring-slate-200 overflow-hidden">
            <CardContent className="p-6">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${colors[color] || colors.slate} ring-1`}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">{title}</p>
                        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{formatLKR(value)}</h3>
                        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

/* ══════════════════════════════════════════════════════════════ */
export default function RevenuePage() {
    const [data, setData] = useState<FinancialData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showDoctors, setShowDoctors] = useState(true);
    const [trendView, setTrendView] = useState<'daily' | 'monthly'>('daily');
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

    const now = useMemo(() => new Date(), []);
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());

    useEffect(() => {
        setLoading(true);
        const year = parseInt(selectedYear);
        const month = parseInt(selectedMonth);
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        const pad = (n: number) => n.toString().padStart(2, '0');
        const startDate = `${firstDay.getFullYear()}-${pad(firstDay.getMonth() + 1)}-${pad(firstDay.getDate())}`;
        const endDate = `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`;

        fetch(`/api/admin/revenue?startDate=${startDate}&endDate=${endDate}`)
            .then(res => res.json())
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [selectedMonth, selectedYear]);

    if (loading) return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
            <div className="h-8 w-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-500">Generating financial reports...</p>
        </div>
    );
    if (!data || data.message || !data.revenue) return <div className="p-12 text-center text-rose-600 font-medium">Unable to load dashboard data.</div>;

    const { revenue, cogs, inventory, profit, doctor_payouts, daily, monthly } = data;
    
    const chartData = trendView === 'daily' ? daily : monthly;
    const maxVal = chartData && chartData.length > 0
        ? Math.max(...chartData.map((d: any) => Math.max(Number(d.gross_revenue), Number(d.patient_billed))), 1)
        : 1;

    return (
        <div className="p-6 md:p-10 space-y-8 max-w-[1600px] mx-auto pb-24 bg-slate-50/50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-2">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Revenue Dashboard</h1>
                    <p className="text-slate-500 text-sm mt-1 font-medium">Financial performance summary and departmental breakdown.</p>
                </div>
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl shadow-sm border border-slate-200">
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-[140px] border-none shadow-none focus:ring-0 font-semibold text-slate-700">
                            <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                            <SelectItem value="0">January</SelectItem>
                            <SelectItem value="1">February</SelectItem>
                            <SelectItem value="2">March</SelectItem>
                            <SelectItem value="3">April</SelectItem>
                            <SelectItem value="4">May</SelectItem>
                            <SelectItem value="5">June</SelectItem>
                            <SelectItem value="6">July</SelectItem>
                            <SelectItem value="7">August</SelectItem>
                            <SelectItem value="8">September</SelectItem>
                            <SelectItem value="9">October</SelectItem>
                            <SelectItem value="10">November</SelectItem>
                            <SelectItem value="11">December</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="h-4 w-[1px] bg-slate-200 mx-1" />
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-[100px] border-none shadow-none focus:ring-0 font-semibold text-slate-700">
                            <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                            {[...Array(5)].map((_, i) => {
                                const year = (new Date().getFullYear() - i).toString();
                                return <SelectItem key={year} value={year}>{year}</SelectItem>;
                            })}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Primary Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard title="Gross Revenue" value={revenue.gross_revenue} icon={TrendingUp} color="blue" subtitle="Total sales volume" />
                <MetricCard title="Total COGS" value={cogs.total_cogs} icon={TrendingDown} color="rose" subtitle="Direct material costs" />
                <MetricCard title="Gross Profit" value={profit.true_gross_profit} icon={Banknote} color="emerald" subtitle="After costs & payouts" />
                <MetricCard title="Inventory Value" value={inventory.asset_value} icon={Package} color="slate" subtitle="Current asset valuation" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Daily Revenue Chart */}
                <Card className="lg:col-span-2 border-none shadow-sm ring-1 ring-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-bold text-slate-800">Revenue Trends Analysis</CardTitle>
                            <CardDescription>
                                {trendView === 'daily' 
                                    ? 'Daily gross revenue vs total patient billing for the selected period.' 
                                    : 'Comprehensive lifetime monthly revenue breakdown by department.'}
                            </CardDescription>
                        </div>
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button 
                                onClick={() => setTrendView('daily')}
                                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${trendView === 'daily' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Daily
                            </button>
                            <button 
                                onClick={() => setTrendView('monthly')}
                                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${trendView === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Monthly
                            </button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 mb-6">
                            {trendView === 'daily' ? (
                                <>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-sm bg-blue-600" />
                                        <span className="text-xs font-semibold text-slate-500">Center Revenue</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-sm bg-slate-200" />
                                        <span className="text-xs font-semibold text-slate-500">Gross Billing</span>
                                    </div>
                                </>
                            ) : (
                                [
                                    { label: 'Service', color: 'bg-blue-500' },
                                    { label: 'Doctor Share', color: 'bg-indigo-500' },
                                    { label: 'Lab', color: 'bg-violet-500' },
                                    { label: 'Pharmacy', color: 'bg-emerald-500' },
                                    { label: 'Total Billed', color: 'bg-slate-200' }
                                ].map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-sm ${item.color}`} />
                                        <span className="text-xs font-semibold text-slate-500">{item.label}</span>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="h-[300px] relative mt-4">
                            {/* Simple Grid Lines */}
                            <div className="absolute inset-0 flex flex-col justify-between">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="w-full border-t border-slate-100 h-0" />
                                ))}
                                <div className="w-full border-t border-slate-300 h-0" />
                            </div>
                            
                            <div className="absolute inset-0 flex items-end gap-2 px-2 overflow-x-auto no-scrollbar">
                                {!chartData || chartData.length === 0 ? (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm italic font-medium">No trend data available</div>
                                ) : chartData.map((day: any, i: number) => {
                                    const maxH = maxVal || 1;
                                    const hTotal = (Number(day.patient_billed) / maxH) * 100;
                                    
                                    const label = trendView === 'daily' 
                                        ? new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                        : new Date(day.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

                                    if (trendView === 'daily') {
                                        const hGross = (Number(day.gross_revenue) / maxH) * 100;
                                        return (
                                            <div key={i} className="group relative flex-1 flex items-end justify-center h-full gap-[1px] min-w-[12px]">
                                                <div className="w-full bg-slate-100 rounded-t-sm transition-all group-hover:bg-slate-200 absolute" style={{ height: `${hTotal}%` }} />
                                                <div className="w-full bg-blue-600 rounded-t-sm transition-all group-hover:bg-blue-700 relative z-10" style={{ height: `${hGross}%` }} />
                                                
                                                <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] p-3 rounded-lg z-20 shadow-xl pointer-events-none min-w-[120px] transition-opacity">
                                                    <p className="font-bold border-b border-white/10 pb-1 mb-1">{label}</p>
                                                    <div className="flex justify-between gap-4">
                                                        <span className="text-white/60">Center</span>
                                                        <span className="font-bold">{formatLKR(day.gross_revenue)}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-4">
                                                        <span className="text-white/60">Total</span>
                                                        <span className="font-bold text-white/80">{formatLKR(day.patient_billed)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    // Stacked Bar for Monthly
                                    const segments = [
                                        { val: Number(day.service_charges), color: 'bg-blue-500' },
                                        { val: Number(day.doctor_commissions), color: 'bg-indigo-500' },
                                        { val: Number(day.lab_revenue), color: 'bg-violet-500' },
                                        { val: Number(day.pharmacy_revenue), color: 'bg-emerald-500' }
                                    ];

                                    return (
                                        <div key={i} className="group relative flex-1 flex flex-col justify-end items-center h-full gap-[1px] min-w-[24px]">
                                            {/* Background for Patient Billed */}
                                            <div className="w-full bg-slate-100 rounded-t-sm absolute bottom-0 z-0 transition-all group-hover:bg-slate-200" style={{ height: `${hTotal}%` }} />
                                            
                                            {/* Stacked segments */}
                                            <div className="w-full flex flex-col-reverse justify-start items-center relative z-10 rounded-t-sm overflow-hidden" style={{ height: `${(Number(day.gross_revenue) / maxH) * 100}%` }}>
                                                {segments.map((seg, idx) => {
                                                    const hSeg = (seg.val / (Number(day.gross_revenue) || 1)) * 100;
                                                    return <div key={idx} className={`w-full ${seg.color} border-t border-white/5`} style={{ height: `${hSeg}%` }} />;
                                                })}
                                            </div>

                                            <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] p-4 rounded-xl z-30 shadow-2xl pointer-events-none min-w-[180px] transition-opacity">
                                                <p className="font-bold border-b border-white/10 pb-2 mb-2 uppercase tracking-widest text-center">{label}</p>
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between">
                                                        <span className="text-white/40">Service</span>
                                                        <span className="font-bold text-blue-400">{formatLKR(day.service_charges)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-white/40">Dr Comm.</span>
                                                        <span className="font-bold text-indigo-400">{formatLKR(day.doctor_commissions)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-white/40">Lab</span>
                                                        <span className="font-bold text-violet-400">{formatLKR(day.lab_revenue)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-white/40">Pharmacy</span>
                                                        <span className="font-bold text-emerald-400">{formatLKR(day.pharmacy_revenue)}</span>
                                                    </div>
                                                    <div className="flex justify-between pt-2 border-t border-white/10 mt-1">
                                                        <span className="text-white/80 font-black">Center Rev</span>
                                                        <span className="font-black text-white">{formatLKR(day.gross_revenue)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-white/40">
                                                        <span>Total Billed</span>
                                                        <span className="font-medium italic">{formatLKR(day.patient_billed)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex justify-between mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
                            <span>{trendView === 'daily' ? 'Beginning' : 'System Inception'}</span>
                            <span>{trendView === 'daily' ? 'Historical Volume Trend' : 'Stacked Category Growth Trend'}</span>
                            <span>{trendView === 'daily' ? 'Today' : 'Current Month'}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Revenue Breakdown */}
                <div className="space-y-8">
                    <Card className="border-none shadow-sm ring-1 ring-slate-200 overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                            <CardTitle className="text-sm font-bold text-slate-700 uppercase tracking-wider">Revenue Breakdown</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-100">
                                {[
                                    { label: 'Service Charges', value: revenue.service_charges, icon: Banknote, color: 'text-blue-600' },
                                    { label: 'Doctor Share', value: revenue.doctor_commissions, icon: Stethoscope, color: 'text-indigo-600' },
                                    { label: 'Lab Services', value: revenue.lab_revenue, icon: FlaskConical, color: 'text-violet-600' },
                                    { label: 'Pharmacy Sales', value: revenue.pharmacy_revenue, icon: Pill, color: 'text-emerald-600' }
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <item.icon className={`h-4 w-4 ${item.color}`} />
                                            <span className="text-sm font-bold text-slate-600">{item.label}</span>
                                        </div>
                                        <span className="text-sm font-black text-slate-900">{formatLKR(item.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm ring-1 ring-slate-200 overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                            <CardTitle className="text-sm font-bold text-slate-700 uppercase tracking-wider">Operational Assets</CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4">
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                                    <span>Stock Value</span>
                                    <span className="text-slate-900">{formatLKR(inventory.asset_value)}</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-600 rounded-full" style={{ width: '85%' }} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                                    <span>Write-offs</span>
                                    <span className="text-rose-600">-{formatLKR(inventory.write_off_value)}</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min((inventory.write_off_value / (inventory.asset_value || 1)) * 100, 100)}%` }} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Doctor Performance Table */}
            <Card className="border-none shadow-sm ring-1 ring-slate-200 overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between bg-white border-b border-slate-100 px-8 py-6">
                    <div>
                        <CardTitle className="text-lg font-bold text-slate-800">Specialist Payout Summary</CardTitle>
                        <CardDescription>Completed appointments and financial splits per specialist.</CardDescription>
                    </div>
                    <button 
                        onClick={() => setShowDoctors(!showDoctors)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest bg-blue-50 px-4 py-2 rounded-lg transition-colors"
                    >
                        {showDoctors ? 'Hide Detailed View' : 'Show Detailed View'}
                    </button>
                </CardHeader>
                {showDoctors && (
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50/50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-8 py-5 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">Specialist Name</th>
                                        <th className="px-8 py-5 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">Department</th>
                                        <th className="px-8 py-5 text-center text-[11px] font-bold uppercase tracking-widest text-slate-400">Cases</th>
                                        <th className="px-8 py-5 text-right text-[11px] font-bold uppercase tracking-widest text-slate-400">Rate</th>
                                        <th className="px-8 py-5 text-right text-[11px] font-bold uppercase tracking-widest text-slate-400">Gross Billed</th>
                                        <th className="px-8 py-5 text-right text-[11px] font-bold uppercase tracking-widest text-slate-400">Center share</th>
                                        <th className="px-8 py-5 text-right text-[11px] font-bold uppercase tracking-widest text-slate-400">Net Payout</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {doctor_payouts.length === 0 ? (
                                        <tr><td colSpan={7} className="p-20 text-center text-slate-400 font-medium italic">No activity recorded for this period.</td></tr>
                                    ) : doctor_payouts.map((d: any, i: number) => (
                                        <tr key={i} className="hover:bg-slate-50/30 transition-colors group">
                                            <td className="px-8 py-5">
                                                <div className="font-bold text-slate-900">{d.doctor_name}</div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-500 px-2.5 py-1 rounded-md">{d.specialization}</span>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <span className="font-bold text-slate-700">{d.completed_appointments}</span>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <span className="text-slate-400 font-medium">{d.commission_rate}%</span>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <span className="font-medium text-slate-600">{formatLKR(d.gross_charged)}</span>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <span className="font-bold text-blue-600">{formatLKR(d.center_commission)}</span>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="text-base font-black text-emerald-600">{formatLKR(d.net_payout)}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                )}
            </Card>
        </div>
    );
}
