'use client';

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
                alert(err.message || 'Payment failed');
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
                <div className="flex gap-2 bg-neutral-100 rounded-lg p-1">
                    {(['PENDING', 'PAID'] as StatusFilter[]).map(s => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${statusFilter === s ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
                        >
                            {s === 'PENDING' ? '⏳ Pending' : '✅ Paid'}
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
                    <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-2 text-sm">
                        <span className="text-amber-600 font-bold">{filtered.length}</span>
                        <span className="text-neutral-500 ml-1">bills awaiting payment</span>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-2 text-sm">
                        <span className="text-emerald-700 font-bold">
                            {formatLKR(filtered.reduce((s, b) => s + Number(b.total_amount), 0))}
                        </span>
                        <span className="text-neutral-500 ml-1">total outstanding</span>
                    </div>
                </div>
            )}

            {/* Bills Table */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                {/* Table Header */}
                <div className="hidden md:grid grid-cols-12 gap-2 px-5 py-3 border-b bg-neutral-50 text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                    <div className="col-span-1">Bill #</div>
                    <div className="col-span-3">Patient</div>
                    <div className="col-span-3">Doctor</div>
                    <div className="col-span-2">Date</div>
                    <div className="col-span-2 text-right">Amount</div>
                    <div className="col-span-1 text-right">
                        {statusFilter === 'PENDING' ? 'Action' : 'Status'}
                    </div>
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
                                        <div className="col-span-1 text-xs font-mono text-neutral-400">#{bill.id}</div>
                                        <div className="col-span-3">
                                            <div className="font-semibold text-sm text-neutral-900">{bill.patient_name}</div>
                                            {bill.patient_phone && (
                                                <div className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5">
                                                    <Phone className="h-3 w-3" />{bill.patient_phone}
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-span-3">
                                            <div className="text-sm text-neutral-700">{bill.doctor_name}</div>
                                            <div className="text-xs text-neutral-400">{bill.specialization}</div>
                                        </div>
                                        <div className="col-span-2 text-xs text-neutral-500">
                                            <div>{new Date(bill.appointment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                            {bill.time_slot && <div>{bill.time_slot}</div>}
                                        </div>
                                        <div className="col-span-2 text-right">
                                            <div className="font-bold text-neutral-900">{formatLKR(bill.total_amount)}</div>
                                        </div>
                                        <div className="col-span-1 flex justify-end items-center gap-1">
                                            {statusFilter === 'PENDING' ? (
                                                <Button
                                                    size="sm"
                                                    className="bg-emerald-600 hover:bg-emerald-700 h-8 px-3 text-xs"
                                                    onClick={(e) => openPay(bill, e)}
                                                >
                                                    <Banknote className="h-3 w-3 mr-1" /> Pay
                                                </Button>
                                            ) : (
                                                <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
                                                    <CheckCircle2 className="h-3 w-3 mr-1" /> Paid
                                                </Badge>
                                            )}
                                            {isExpanded
                                                ? <ChevronUp className="h-4 w-4 text-neutral-300 shrink-0" />
                                                : <ChevronDown className="h-4 w-4 text-neutral-300 shrink-0" />
                                            }
                                        </div>
                                    </div>

                                    {/* Expanded Itemized Breakdown */}
                                    {isExpanded && (
                                        <div className="bg-neutral-50 border-t px-5 py-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                                {/* Left: Bill breakdown */}
                                                <div className="space-y-3">
                                                    <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Invoice Breakdown</h4>

                                                    <div className="space-y-2">
                                                        {/* Doctor Fee */}
                                                        <div className="flex items-center gap-2">
                                                            <Stethoscope className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                                            <div className="flex-1 flex justify-between text-sm">
                                                                <span className="text-neutral-600">Doctor Consultation</span>
                                                                <span className="font-medium">{formatLKR(bill.doctor_fee)}</span>
                                                            </div>
                                                        </div>

                                                        {/* Service Charge */}
                                                        {Number(bill.service_charge) > 0 && (
                                                            <div className="flex items-center gap-2">
                                                                <Receipt className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                                                                <div className="flex-1 flex justify-between text-sm">
                                                                    <span className="text-neutral-600">Service Charge</span>
                                                                    <span className="font-medium">{formatLKR(bill.service_charge)}</span>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Lab Tests */}
                                                        {bill.lab_items?.length > 0 && (
                                                            <div className="flex items-start gap-2">
                                                                <FlaskConical className="h-3.5 w-3.5 text-purple-500 shrink-0 mt-0.5" />
                                                                <div className="flex-1">
                                                                    <div className="flex justify-between text-sm mb-1">
                                                                        <span className="text-neutral-600">Lab Tests</span>
                                                                        <span className="font-medium">{formatLKR(bill.lab_total)}</span>
                                                                    </div>
                                                                    <div className="space-y-0.5 pl-1 border-l-2 border-purple-100">
                                                                        {bill.lab_items.map((lt: any, i: number) => (
                                                                            <div key={i} className="flex justify-between text-xs text-neutral-400">
                                                                                <span>{lt.name}</span>
                                                                                <span className="flex items-center gap-1">
                                                                                    {formatLKR(lt.price)}
                                                                                    <Badge className={`ml-1 text-[9px] px-1 py-0 border-0 ${lt.lab_status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                                                                        {lt.lab_status}
                                                                                    </Badge>
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Medicines */}
                                                        {bill.medicine_items?.length > 0 && (
                                                            <div className="flex items-start gap-2">
                                                                <Pill className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                                                <div className="flex-1">
                                                                    <div className="flex justify-between text-sm mb-1">
                                                                        <span className="text-neutral-600">Medicines</span>
                                                                        <span className="font-medium">{formatLKR(bill.pharmacy_total)}</span>
                                                                    </div>
                                                                    <div className="space-y-0.5 pl-1 border-l-2 border-emerald-100">
                                                                        {bill.medicine_items.map((m: any, i: number) => (
                                                                            <div key={i} className="flex justify-between text-xs text-neutral-400">
                                                                                <span>{m.medicine_name} <span className="text-neutral-300">× {m.qty} {m.unit}</span></span>
                                                                                <span>{formatLKR(m.line_total)}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Total */}
                                                        <div className="flex justify-between items-center border-t pt-2 font-bold text-sm">
                                                            <span>Total</span>
                                                            <span className="text-base text-neutral-900">{formatLKR(bill.total_amount)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right: Patient info + payment status */}
                                                <div className="space-y-3">
                                                    <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Patient & Payment</h4>
                                                    <div className="space-y-1.5 text-sm">
                                                        <div className="flex gap-2">
                                                            <User className="h-4 w-4 text-neutral-400 shrink-0 mt-0.5" />
                                                            <div>
                                                                <div className="font-medium">{bill.patient_name}</div>
                                                                <div className="text-xs text-neutral-400">{bill.patient_email}</div>
                                                            </div>
                                                        </div>
                                                        {bill.patient_phone && (
                                                            <div className="flex gap-2 text-neutral-500">
                                                                <Phone className="h-4 w-4 shrink-0" />
                                                                <span>{bill.patient_phone}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="border rounded-lg p-3 space-y-2 text-sm bg-white">
                                                        <div className="flex justify-between">
                                                            <span className="text-neutral-500">Status</span>
                                                            <Badge className={bill.status === 'PAID'
                                                                ? 'bg-emerald-100 text-emerald-700 border-0'
                                                                : 'bg-amber-100 text-amber-700 border-0'}>
                                                                {bill.status === 'PAID' ? <CheckCircle2 className="h-3 w-3 mr-1 inline" /> : <Clock className="h-3 w-3 mr-1 inline" />}
                                                                {bill.status}
                                                            </Badge>
                                                        </div>
                                                        {bill.payment_method && (
                                                            <div className="flex justify-between">
                                                                <span className="text-neutral-500">Method</span>
                                                                <span className="font-medium">{bill.payment_method}</span>
                                                            </div>
                                                        )}
                                                        {bill.paid_at && (
                                                            <div className="flex justify-between">
                                                                <span className="text-neutral-500">Paid At</span>
                                                                <span className="font-medium">{new Date(bill.paid_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        )}
                                                        {bill.paid_by_name && (
                                                            <div className="flex justify-between">
                                                                <span className="text-neutral-500">Processed by</span>
                                                                <span className="font-medium">{bill.paid_by_name}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between text-xs text-neutral-400">
                                                            <span>Generated</span>
                                                            <span>{new Date(bill.generated_at).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>

                                                    {statusFilter === 'PENDING' && (
                                                        <Button
                                                            className="w-full bg-emerald-600 hover:bg-emerald-700 h-10"
                                                            onClick={(e) => openPay(bill, e)}
                                                        >
                                                            <Banknote className="h-4 w-4 mr-2" /> Process Payment
                                                        </Button>
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
                                className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700"
                            >
                                {paying ? (
                                    <span className="flex items-center gap-2"><span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Processing...</span>
                                ) : (
                                    <span className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> Confirm Payment · {formatLKR(selectedBill.total_amount)}</span>
                                )}
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
