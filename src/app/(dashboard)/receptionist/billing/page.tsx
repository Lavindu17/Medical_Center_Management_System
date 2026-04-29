'use client';
import { toast } from 'sonner';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Banknote, Search, FlaskConical, Pill, Stethoscope,
    Receipt, CheckCircle2, Clock, CreditCard, User, Phone, ChevronDown, ChevronUp
} from 'lucide-react';

function formatLKR(val: any) {
    return `LKR ${Number(val || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type StatusFilter = 'PENDING' | 'PAID';

export default function BillingPage() {
    const [bills, setBills] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState<number | null>(null);

    // Payment modal
    const [selectedBill, setSelectedBill] = useState<any>(null);
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [paying, setPaying] = useState(false);
    const [isPayOpen, setIsPayOpen] = useState(false);

    const fetchBills = async (status: StatusFilter) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/receptionist/billing?status=${status}`);
            if (res.ok) setBills(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchBills(statusFilter); }, [statusFilter]);

    const filtered = useMemo(() => {
        if (!search.trim()) return bills;
        const q = search.toLowerCase();
        return bills.filter(b =>
            b.patient_name?.toLowerCase().includes(q) ||
            b.doctor_name?.toLowerCase().includes(q) ||
            String(b.id).includes(q)
        );
    }, [bills, search]);

    const handlePay = async () => {
        if (!selectedBill) return;
        setPaying(true);
        try {
            const res = await fetch('/api/receptionist/billing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bill_id: selectedBill.id, payment_method: paymentMethod }),
            });
            if (res.ok) {
                setIsPayOpen(false);
                setSelectedBill(null);
                fetchBills(statusFilter);
            } else {
                const err = await res.json();
                toast.error(err.message || 'Payment failed');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setPaying(false);
        }
    };

    const openPay = (bill: any, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedBill(bill);
        setPaymentMethod('CASH');
        setIsPayOpen(true);
    };

    const toggle = (id: number) => setExpandedId(prev => prev === id ? null : id);

    return (
        <div className="space-y-5 p-6">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">Billing & Payments</h1>
                    <p className="text-sm text-neutral-500 mt-1">Process patient payments and view billing history.</p>
                </div>
                <div className="flex gap-1 bg-neutral-100/80 p-1.5 rounded-xl border border-neutral-200">
                    {(['PENDING', 'PAID'] as StatusFilter[]).map(s => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${
                                statusFilter === s 
                                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 scale-105' 
                                    : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/50'
                            }`}
                        >
                            {s === 'PENDING' ? (
                                <span className="flex items-center gap-2"><Clock className="h-4 w-4" /> PENDING</span>
                            ) : (
                                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> PAID</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                    placeholder="Search patient, doctor, bill #..."
                    className="pl-9"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Summary Strip (PENDING only) */}
            {statusFilter === 'PENDING' && !loading && filtered.length > 0 && (
                <div className="flex gap-4 flex-wrap">
                    <div className="bg-white border-l-4 border-amber-500 shadow-sm rounded-r-xl px-5 py-3 flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Awaiting Payment</p>
                            <p className="text-xl font-black text-amber-600 leading-none mt-1">{filtered.length} Bills</p>
                        </div>
                    </div>
                    <div className="bg-white border-l-4 border-emerald-500 shadow-sm rounded-r-xl px-5 py-3 flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
                            <Banknote className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Total Outstanding</p>
                            <p className="text-xl font-black text-emerald-700 leading-none mt-1">
                                {formatLKR(filtered.reduce((s, b) => s + Number(b.total_amount), 0))}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Bills Table */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                {/* Table Header */}
                <div className="hidden md:grid grid-cols-12 gap-2 px-6 py-4 border-b bg-neutral-50/50 text-[11px] font-bold text-neutral-400 uppercase tracking-widest">
                    <div className="col-span-1">ID</div>
                    <div className="col-span-3">Patient Details</div>
                    <div className="col-span-3">Assigned Doctor</div>
                    <div className="col-span-2">Schedule</div>
                    <div className="col-span-2 text-right pr-8">Total Amount</div>
                    <div className="col-span-1 text-right">Actions</div>
                </div>

                {loading ? (
                    <div className="p-10 text-center text-neutral-400 text-sm">Loading bills...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-10 text-center text-neutral-400">
                        <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        <p>No {statusFilter.toLowerCase()} bills found.</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {filtered.map(bill => {
                            const isExpanded = expandedId === bill.id;
                            return (
                                <div key={bill.id}>
                                    {/* Main Row */}
                                    <div
                                        className="grid grid-cols-12 gap-2 px-5 py-4 items-center hover:bg-neutral-50 cursor-pointer transition-colors"
                                        onClick={() => toggle(bill.id)}
                                    >
                                        <div className="col-span-1">
                                            <span className="text-[10px] font-mono font-bold bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded">#{bill.id}</span>
                                        </div>
                                        <div className="col-span-3">
                                            <div className="font-bold text-sm text-neutral-800 tracking-tight">{bill.patient_name}</div>
                                            {bill.patient_phone && (
                                                <div className="text-[11px] text-neutral-400 flex items-center gap-1 mt-0.5 font-medium">
                                                    <Phone className="h-3 w-3 opacity-70" />{bill.patient_phone}
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-span-3">
                                            <div className="text-sm font-semibold text-neutral-700">{bill.doctor_name}</div>
                                            <div className="text-[11px] text-neutral-400 font-medium uppercase tracking-tighter">{bill.specialization}</div>
                                        </div>
                                        <div className="col-span-2">
                                            <div className="text-xs font-bold text-neutral-600">{new Date(bill.appointment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                            {bill.time_slot && <div className="text-[10px] text-neutral-400 font-medium">{bill.time_slot}</div>}
                                        </div>
                                        <div className="col-span-2 text-right pr-8">
                                            <div className="font-black text-emerald-700 text-base">{formatLKR(bill.total_amount)}</div>
                                        </div>
                                        <div className="col-span-1 flex justify-end items-center gap-1">
                                            {statusFilter === 'PENDING' ? (
                                                <Button
                                                    size="sm"
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-100 h-8 px-4 text-xs font-bold transition-all"
                                                    onClick={(e) => openPay(bill, e)}
                                                >
                                                    <Banknote className="h-3.5 w-3.5 mr-1.5" /> PAY
                                                </Button>
                                            ) : (
                                                <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
                                                    <CheckCircle2 className="h-3 w-3 mr-1" /> Paid
                                                </Badge>
                                            )}
                                            <div className={`p-1.5 rounded-full transition-all duration-200 ${isExpanded ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:scale-110'}`}>
                                                {isExpanded
                                                    ? <ChevronUp className="h-4 w-4 shrink-0" />
                                                    : <ChevronDown className="h-4 w-4 shrink-0" />
                                                }
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Itemized Breakdown */}
                                    {isExpanded && (
                                        <div className="bg-neutral-50/50 border-t border-b border-neutral-100 p-6 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                                                {/* Left Column: Breakdown Receipt */}
                                                <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                                                    <div className="bg-neutral-900 text-white px-6 py-3 flex justify-between items-center">
                                                        <h4 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                                                            <Receipt className="h-3.5 w-3.5 text-emerald-400" /> Itemized Invoice
                                                        </h4>
                                                        <span className="text-[10px] font-mono opacity-60">REF: {bill.id}-{new Date(bill.generated_at).getTime()}</span>
                                                    </div>
                                                    
                                                    <div className="p-6 space-y-6">
                                                        {/* Section: Consultation */}
                                                        <div className="space-y-3">
                                                            <div className="flex justify-between items-end border-b border-neutral-50 pb-2">
                                                                <div className="flex items-center gap-2 text-neutral-500">
                                                                    <Stethoscope className="h-4 w-4 text-blue-500" />
                                                                    <span className="text-xs font-bold uppercase">Consultation Services</span>
                                                                </div>
                                                                <span className="text-xs font-bold text-neutral-400 italic">Rate: Standard</span>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <div className="flex justify-between text-sm">
                                                                    <span className="text-neutral-600 font-medium">Doctor Consultation Fee</span>
                                                                    <span className="font-bold text-neutral-800">{formatLKR(bill.doctor_fee)}</span>
                                                                </div>
                                                                {Number(bill.service_charge) > 0 && (
                                                                    <div className="flex justify-between text-sm">
                                                                        <span className="text-neutral-600 font-medium">Administrative Service Charge</span>
                                                                        <span className="font-bold text-neutral-800">{formatLKR(bill.service_charge)}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Section: Lab Tests */}
                                                        {bill.lab_items?.length > 0 && (
                                                            <div className="space-y-3">
                                                                <div className="flex justify-between items-end border-b border-neutral-50 pb-2">
                                                                    <div className="flex items-center gap-2 text-neutral-500">
                                                                        <FlaskConical className="h-4 w-4 text-purple-500" />
                                                                        <span className="text-xs font-bold uppercase">Clinical Laboratory Tests</span>
                                                                    </div>
                                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
                                                                        {bill.lab_items.length} Items
                                                                    </span>
                                                                </div>
                                                                <div className="divide-y divide-neutral-50 bg-neutral-50/30 rounded-lg border border-neutral-50">
                                                                    {bill.lab_items.map((lt: any, i: number) => (
                                                                        <div key={i} className="flex justify-between px-3 py-2 text-xs">
                                                                            <span className="text-neutral-600 font-medium">{lt.name}</span>
                                                                            <div className="flex items-center gap-3">
                                                                                <Badge className={`text-[9px] px-1.5 py-0 border-0 ${lt.lab_status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                                                                    {lt.lab_status}
                                                                                </Badge>
                                                                                <span className="font-bold text-neutral-800 min-w-[80px] text-right">{formatLKR(lt.price)}</span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Section: Medicines */}
                                                        {bill.medicine_items?.length > 0 && (
                                                            <div className="space-y-3">
                                                                <div className="flex justify-between items-end border-b border-neutral-50 pb-2">
                                                                    <div className="flex items-center gap-2 text-neutral-500">
                                                                        <Pill className="h-4 w-4 text-emerald-500" />
                                                                        <span className="text-xs font-bold uppercase">Pharmacy Prescription</span>
                                                                    </div>
                                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                                                                        Dispensed
                                                                    </span>
                                                                </div>
                                                                <div className="divide-y divide-neutral-50 bg-neutral-50/30 rounded-lg border border-neutral-50">
                                                                    {bill.medicine_items.map((m: any, i: number) => (
                                                                        <div key={i} className="flex justify-between px-3 py-2 text-xs">
                                                                            <div className="flex flex-col">
                                                                                <span className="text-neutral-600 font-bold">{m.medicine_name}</span>
                                                                                <span className="text-[10px] text-neutral-400 uppercase tracking-tighter font-medium">QTY: {m.qty} {m.unit}</span>
                                                                            </div>
                                                                            <span className="font-bold text-neutral-800 self-center">{formatLKR(m.line_total)}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Total Summary */}
                                                        <div className="bg-emerald-50/50 rounded-xl p-4 flex justify-between items-center border border-emerald-100">
                                                            <div>
                                                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Total Payable Amount</p>
                                                                <p className="text-xs text-neutral-400 font-medium">Includes all taxes and fees</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-2xl font-black text-emerald-800 leading-none">{formatLKR(bill.total_amount)}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right Column: Processing Details */}
                                                <div className="space-y-6">
                                                    <div>
                                                        <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest mb-3">Processing Details</h4>
                                                        <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-4 shadow-sm">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center border border-neutral-200 shadow-inner">
                                                                    <User className="h-5 w-5 text-neutral-500" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-bold text-neutral-800">{bill.patient_name}</p>
                                                                    <p className="text-[11px] text-neutral-400 font-medium">{bill.patient_email || 'No email provided'}</p>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-2 pt-2 border-t border-neutral-50">
                                                                <div className="flex justify-between items-center text-xs">
                                                                    <span className="text-neutral-400 font-medium">Payment Status</span>
                                                                    <Badge className={`px-2 py-0.5 border-0 font-bold tracking-tight ${bill.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                        {bill.status === 'PAID' ? <CheckCircle2 className="h-3 w-3 mr-1 inline" /> : <Clock className="h-3 w-3 mr-1 inline" />}
                                                                        {bill.status}
                                                                    </Badge>
                                                                </div>
                                                                {bill.payment_method && (
                                                                    <div className="flex justify-between items-center text-xs">
                                                                        <span className="text-neutral-400 font-medium">Method</span>
                                                                        <span className="font-bold text-neutral-800">{bill.payment_method}</span>
                                                                    </div>
                                                                )}
                                                                {bill.paid_at && (
                                                                    <div className="flex justify-between items-center text-xs">
                                                                        <span className="text-neutral-400 font-medium">Timestamp</span>
                                                                        <span className="font-bold text-neutral-800">{new Date(bill.paid_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {statusFilter === 'PENDING' && (
                                                        <div className="space-y-3">
                                                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1">Quick Actions</p>
                                                            <Button
                                                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-100 h-12 font-black transition-all active:scale-95"
                                                                onClick={(e) => openPay(bill, e)}
                                                            >
                                                                <Banknote className="h-5 w-5 mr-2" /> COLLECT PAYMENT
                                                            </Button>
                                                            <p className="text-[10px] text-center text-neutral-400 italic">Please verify all items before collection</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Payment Confirmation Dialog */}
            <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-emerald-600" />
                            Process Payment
                        </DialogTitle>
                    </DialogHeader>

                    {selectedBill && (
                        <div className="space-y-5 pt-1">
                            {/* Patient Info */}
                            <div className="flex items-center gap-3 bg-neutral-50 rounded-lg p-3">
                                <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center">
                                    <User className="h-5 w-5 text-emerald-700" />
                                </div>
                                <div>
                                    <div className="font-semibold text-sm">{selectedBill.patient_name}</div>
                                    <div className="text-xs text-neutral-400">Bill #{selectedBill.id} · {new Date(selectedBill.appointment_date).toLocaleDateString()}</div>
                                </div>
                            </div>

                            {/* Itemized Summary */}
                            <div className="rounded-lg border divide-y text-sm">
                                <div className="flex justify-between px-4 py-2.5">
                                    <span className="text-neutral-500 flex items-center gap-2"><Stethoscope className="h-3.5 w-3.5 text-blue-400" /> Doctor Fee</span>
                                    <span className="font-medium">{formatLKR(selectedBill.doctor_fee)}</span>
                                </div>
                                {Number(selectedBill.service_charge) > 0 && (
                                    <div className="flex justify-between px-4 py-2.5">
                                        <span className="text-neutral-500 flex items-center gap-2"><Receipt className="h-3.5 w-3.5 text-neutral-400" /> Service Charge</span>
                                        <span className="font-medium">{formatLKR(selectedBill.service_charge)}</span>
                                    </div>
                                )}
                                {Number(selectedBill.lab_total) > 0 && (
                                    <div className="flex justify-between px-4 py-2.5">
                                        <span className="text-neutral-500 flex items-center gap-2"><FlaskConical className="h-3.5 w-3.5 text-purple-400" /> Lab Tests</span>
                                        <span className="font-medium">{formatLKR(selectedBill.lab_total)}</span>
                                    </div>
                                )}
                                {Number(selectedBill.pharmacy_total) > 0 && (
                                    <div className="flex justify-between px-4 py-2.5">
                                        <span className="text-neutral-500 flex items-center gap-2"><Pill className="h-3.5 w-3.5 text-emerald-400" /> Medicines</span>
                                        <span className="font-medium">{formatLKR(selectedBill.pharmacy_total)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between px-4 py-3 bg-neutral-50 font-bold">
                                    <span>Total Payable</span>
                                    <span className="text-lg text-emerald-700">{formatLKR(selectedBill.total_amount)}</span>
                                </div>
                            </div>

                            {/* Payment Method */}
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">Payment Method</Label>
                                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CASH">💵 Cash</SelectItem>
                                        <SelectItem value="CARD">💳 Credit / Debit Card</SelectItem>
                                        <SelectItem value="INSURANCE">🏥 Insurance</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Confirm Button */}
                            <Button
                                onClick={handlePay}
                                disabled={paying}
                                className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-200 transition-all active:scale-[0.98]"
                            >
                                {paying ? (
                                    <span className="flex items-center gap-2">
                                        <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" /> 
                                        Processing Payment...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <CheckCircle2 className="h-5 w-5" /> Confirm & Pay {formatLKR(selectedBill.total_amount)}
                                    </span>
                                )}
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
