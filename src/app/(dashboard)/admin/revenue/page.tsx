'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatLKR } from '@/lib/utils';
import {
    Banknote, TrendingUp, TrendingDown, Package, Pill,
    FlaskConical, Stethoscope, AlertTriangle, ChevronDown
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FinancialData {
    revenue: { service_charges: number; doctor_commissions: number; lab_revenue: number; pharmacy_revenue: number; gross_revenue: number; };
    cogs: { medicine_cogs: number; lab_cogs: number; total_cogs: number; };
    inventory: { asset_value: number; write_off_value: number; };
    profit: { total_doctor_payouts: number; true_gross_profit: number; };
    doctor_payouts: any[];
    daily: { date: string; gross_revenue: number; patient_billed: number; }[];
}

function StatCard({ title, value, subtitle, icon: Icon, colorClass = 'text-neutral-800', bgClass = 'bg-neutral-50', negative = false }: any) {
    return (
        <Card className={`border ${bgClass}`}>
            <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-start justify-between">
                <CardTitle className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{title}</CardTitle>
                <Icon className={`h-4 w-4 ${colorClass}`} />
            </CardHeader>
            <CardContent className="px-4 pb-4">
                <div className={`text-2xl font-bold ${colorClass}`}>{negative ? '- ' : ''}{formatLKR(value)}</div>
                {subtitle && <p className="text-xs text-neutral-400 mt-1">{subtitle}</p>}
            </CardContent>
        </Card>
    );
}

export default function RevenuePage() {
    const [data, setData] = useState<FinancialData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showDoctors, setShowDoctors] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

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

    if (loading) return <div className="p-8 text-neutral-500">Loading analytics...</div>;
    if (!data || data.message || !data.revenue) return <div className="p-8 text-red-500">Failed to load financial data: {data?.message || 'Unknown error'}</div>;

    const { revenue, cogs, inventory, profit, doctor_payouts, daily } = data;
    const maxDaily = daily && daily.length > 0
        ? Math.max(...daily.map((d: any) => Math.max(Number(d.gross_revenue), Number(d.patient_billed))), 1)
        : 1;

    return (
        <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">Financial Dashboard</h1>
                    <p className="text-sm text-neutral-500 mt-1">Medical center revenue, costs, and profitability analysis.</p>
                </div>
                <div className="flex gap-2">
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-[140px] bg-white">
                            <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
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
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-[110px] bg-white">
                            <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                            {[...Array(5)].map((_, i) => {
                                const year = (new Date().getFullYear() - i).toString();
                                return <SelectItem key={year} value={year}>{year}</SelectItem>;
                            })}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* ── A. Gross Revenue ─────────────────────────────────── */}
            <section className="space-y-3">
                <div className="flex items-center gap-2">
                    <h2 className="font-bold text-neutral-800">A — Gross Revenue</h2>
                    <span className="text-xs text-neutral-400">(Center's top-line income)</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <StatCard title="Service Charges" value={revenue.service_charges} icon={Banknote} colorClass="text-blue-700" bgClass="bg-blue-50/40 border-blue-100" subtitle="Registration & admin fees" />
                    <StatCard title="Doctor Commissions" value={revenue.doctor_commissions} icon={Stethoscope} colorClass="text-indigo-700" bgClass="bg-indigo-50/40 border-indigo-100" subtitle="% retained from doctor fees" />
                    <StatCard title="Lab Revenue" value={revenue.lab_revenue} icon={FlaskConical} colorClass="text-purple-700" bgClass="bg-purple-50/40 border-purple-100" subtitle="Diagnostic services billed" />
                    <StatCard title="Pharmacy Revenue" value={revenue.pharmacy_revenue} icon={Pill} colorClass="text-emerald-700" bgClass="bg-emerald-50/40 border-emerald-100" subtitle="Medicines sold" />
                    <Card className="border-2 border-blue-200 bg-blue-50">
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Total Gross Revenue</CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <div className="text-2xl font-bold text-blue-800">{formatLKR(revenue.gross_revenue)}</div>
                            <p className="text-xs text-blue-500 mt-1">All center income before expenses</p>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* ── B. COGS ──────────────────────────────────────────── */}
            <section className="space-y-3">
                <div className="flex items-center gap-2">
                    <h2 className="font-bold text-neutral-800">B — Cost of Goods Sold (COGS)</h2>
                    <span className="text-xs text-neutral-400">(Direct costs from dispensed items)</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <StatCard title="Medicine COGS" value={cogs.medicine_cogs} icon={Pill} colorClass="text-orange-700" bgClass="bg-orange-50/40 border-orange-100" subtitle="Buying cost of dispensed medicines" negative />
                    <StatCard title="Lab COGS" value={cogs.lab_cogs} icon={FlaskConical} colorClass="text-pink-700" bgClass="bg-pink-50/40 border-pink-100" subtitle="Cost of completed lab tests" negative />
                    <Card className="border-2 border-orange-200 bg-orange-50">
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Total COGS</CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <div className="text-2xl font-bold text-orange-800">- {formatLKR(cogs.total_cogs)}</div>
                            <p className="text-xs text-orange-500 mt-1">Direct costs of goods & services</p>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* ── C. Inventory Valuation ───────────────────────────── */}
            <section className="space-y-3">
                <div className="flex items-center gap-2">
                    <h2 className="font-bold text-neutral-800">C — Inventory Valuation</h2>
                    <span className="text-xs text-neutral-400">(Stock assets vs. write-off losses)</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Card className="border-emerald-200 bg-emerald-50/40">
                        <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-start justify-between">
                            <CardTitle className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Active Inventory Value</CardTitle>
                            <Package className="h-4 w-4 text-emerald-600" />
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <div className="text-2xl font-bold text-emerald-700">{formatLKR(inventory.asset_value)}</div>
                            <p className="text-xs text-neutral-400 mt-1">Unexpired stock at buying price (current asset)</p>
                        </CardContent>
                    </Card>
                    <Card className="border-red-200 bg-red-50/40">
                        <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-start justify-between">
                            <CardTitle className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Inventory Write-Off</CardTitle>
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <div className="text-2xl font-bold text-red-700">- {formatLKR(inventory.write_off_value)}</div>
                            <p className="text-xs text-neutral-400 mt-1">Expired stock with remaining quantity (loss)</p>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* ── D. True Gross Profit ─────────────────────────────── */}
            <section className="space-y-3">
                <h2 className="font-bold text-neutral-800">D — Bottom Line</h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Card className="border-neutral-200">
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Total Doctor Payouts</CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <div className="text-2xl font-bold text-neutral-700">- {formatLKR(profit.total_doctor_payouts)}</div>
                            <p className="text-xs text-neutral-400 mt-1">Net earnings paid to doctors</p>
                        </CardContent>
                    </Card>
                    <div className="lg:col-span-2">
                        <Card className={`border-2 h-full ${profit.true_gross_profit >= 0 ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
                            <CardHeader className="pb-2 pt-4 px-4">
                                <CardTitle className={`text-sm font-bold uppercase tracking-wide ${profit.true_gross_profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>True Gross Profit</CardTitle>
                                <CardDescription className="text-xs">
                                    Gross Revenue − COGS − Doctor Payouts − Write-Offs
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="px-4 pb-4">
                                <div className={`text-4xl font-bold ${profit.true_gross_profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                    {profit.true_gross_profit >= 0 ? '' : '- '}{formatLKR(Math.abs(profit.true_gross_profit))}
                                </div>
                                <p className="text-xs text-neutral-500 mt-2">
                                    {formatLKR(revenue.gross_revenue)} − {formatLKR(cogs.total_cogs)} − {formatLKR(profit.total_doctor_payouts)} − {formatLKR(inventory.write_off_value)}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* ── E. Doctor Payouts Table ──────────────────────────── */}
            <section className="space-y-3">
                <button
                    className="flex items-center gap-2 font-bold text-neutral-800 hover:text-emerald-700 transition-colors"
                    onClick={() => setShowDoctors(!showDoctors)}
                >
                    <h2>E — Doctor Payout Summary</h2>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showDoctors ? 'rotate-180' : ''}`} />
                </button>
                {showDoctors && (
                    <Card>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-neutral-50 border-b text-neutral-500 font-semibold text-xs uppercase">
                                        <tr>
                                            <th className="p-3 text-left">Doctor</th>
                                            <th className="p-3 text-left">Specialization</th>
                                            <th className="p-3 text-center">Completed</th>
                                            <th className="p-3 text-right">Commission %</th>
                                            <th className="p-3 text-right">Gross Billed</th>
                                            <th className="p-3 text-right text-blue-600">Center Kept</th>
                                            <th className="p-3 text-right text-emerald-700">Net Payout</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {doctor_payouts.length === 0 ? (
                                            <tr><td colSpan={7} className="p-6 text-center text-neutral-400">No completed appointments yet.</td></tr>
                                        ) : doctor_payouts.map((d: any, i: number) => (
                                            <tr key={i} className="hover:bg-neutral-50">
                                                <td className="p-3 font-medium text-neutral-800">{d.doctor_name}</td>
                                                <td className="p-3 text-neutral-500">{d.specialization}</td>
                                                <td className="p-3 text-center font-bold">{d.completed_appointments}</td>
                                                <td className="p-3 text-right text-neutral-600">{d.commission_rate}%</td>
                                                <td className="p-3 text-right">{formatLKR(d.gross_charged)}</td>
                                                <td className="p-3 text-right text-blue-600">{formatLKR(d.center_commission)}</td>
                                                <td className="p-3 text-right font-bold text-emerald-700">{formatLKR(d.net_payout)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </section>

            {/* ── F. Daily Chart ───────────────────────────────────── */}
            <section className="space-y-3">
                <h2 className="font-bold text-neutral-800">F — Daily Revenue (Selected Month)</h2>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex gap-4 mb-3">
                            <span className="flex items-center gap-1.5 text-xs text-neutral-500"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Center Revenue</span>
                            <span className="flex items-center gap-1.5 text-xs text-neutral-500"><span className="w-3 h-3 rounded-sm bg-neutral-200 inline-block" /> Patient Billed</span>
                        </div>
                        <div className="h-[220px] flex items-end gap-1 border-b border-l border-neutral-200 pb-0 pl-0">
                            {daily.length === 0 ? (
                                <div className="w-full flex items-center justify-center text-neutral-400 text-sm h-full">No data in the selected month.</div>
                            ) : daily.map((day, i) => {
                                const hGross = (Number(day.gross_revenue) / maxDaily) * 100;
                                const hBilled = (Number(day.patient_billed) / maxDaily) * 100;
                                return (
                                    <div key={i} className="group relative flex-1 flex items-end gap-0.5 h-full">
                                        <div className="flex-1 bg-neutral-200 rounded-t-sm transition-all hover:bg-neutral-300" style={{ height: `${hBilled}%` }} />
                                        <div className="flex-1 bg-blue-500 rounded-t-sm transition-all hover:bg-blue-600" style={{ height: `${hGross}%` }} />
                                        <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-[10px] p-1.5 rounded z-10 whitespace-nowrap pointer-events-none">
                                            {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}<br />
                                            Center: {formatLKR(day.gross_revenue)}<br />
                                            Patient: {formatLKR(day.patient_billed)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-between mt-1 text-xs text-neutral-400 px-1">
                            <span>Start of month</span><span>End of month</span>
                        </div>
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}
