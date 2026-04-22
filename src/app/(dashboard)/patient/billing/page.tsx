'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatLKR } from '@/lib/utils';
import { Stethoscope, FlaskConical, Pill, Receipt, ChevronDown, ChevronUp } from 'lucide-react';

export default function BillingPage() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    useEffect(() => {
        fetch('/api/auth/session')
            .then(res => res.json())
            .then(session => fetch(`/api/patient/records?patientId=${session.user.id}&type=bills`))
            .then(res => res.json())
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="p-8 text-neutral-500">Loading billing history...</div>;

    return (
        <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold text-neutral-900">Billing History</h1>
                <p className="text-sm text-neutral-500 mt-1">Itemized invoices for all your appointments.</p>
            </div>

            {data.length === 0 ? (
                <div className="text-center py-16 text-neutral-400">
                    <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No bills found.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {data.map((bill) => {
                        const isExpanded = expandedId === bill.id;
                        const isPaid = bill.status === 'PAID';
                        return (
                            <Card key={bill.id} className={`border transition-shadow ${isPaid ? 'border-emerald-100' : 'border-amber-100'}`}>
                                {/* Invoice Header */}
                                <div
                                    className="flex items-center justify-between p-5 cursor-pointer select-none"
                                    onClick={() => setExpandedId(isExpanded ? null : bill.id)}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={`p-2.5 rounded-lg ${isPaid ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                                            <Receipt className={`h-5 w-5 ${isPaid ? 'text-emerald-600' : 'text-amber-600'}`} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-neutral-900">Invoice #{bill.id}</span>
                                                <Badge className={isPaid
                                                    ? 'bg-emerald-100 text-emerald-700 border-0'
                                                    : 'bg-amber-100 text-amber-700 border-0'
                                                }>{bill.status}</Badge>
                                            </div>
                                            <p className="text-sm text-neutral-500 mt-0.5">
                                                {new Date(bill.appointmentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                &nbsp;·&nbsp; Dr. {bill.doctorName}
                                                {bill.specialization && <span className="text-neutral-400"> ({bill.specialization})</span>}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="font-bold text-xl text-neutral-900">{formatLKR(bill.total_amount)}</div>
                                            {bill.paid_at && <p className="text-xs text-neutral-400">Paid {new Date(bill.paid_at).toLocaleDateString()}</p>}
                                        </div>
                                        {isExpanded ? <ChevronUp className="h-4 w-4 text-neutral-400" /> : <ChevronDown className="h-4 w-4 text-neutral-400" />}
                                    </div>
                                </div>

                                {/* Expanded Itemized View */}
                                {isExpanded && (
                                    <CardContent className="border-t pt-4 pb-5 space-y-4">
                                        <div className="space-y-3">

                                            {/* Consultation */}
                                            <div className="flex items-center gap-3">
                                                <Stethoscope className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                                                <div className="flex-1">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="font-medium text-neutral-700">Doctor Consultation Fee</span>
                                                        <span className="font-semibold">{formatLKR(bill.doctor_fee)}</span>
                                                    </div>
                                                    <p className="text-xs text-neutral-400">Dr. {bill.doctorName} · {bill.specialization}</p>
                                                </div>
                                            </div>

                                            {/* Service Charge */}
                                            {Number(bill.service_charge) > 0 && (
                                                <div className="flex items-center gap-3">
                                                    <Receipt className="h-4 w-4 text-neutral-400 shrink-0 mt-0.5" />
                                                    <div className="flex-1">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="font-medium text-neutral-700">Service Charge</span>
                                                            <span className="font-semibold">{formatLKR(bill.service_charge)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Lab Tests */}
                                            {bill.lab_items?.length > 0 && (
                                                <div className="flex items-start gap-3">
                                                    <FlaskConical className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
                                                    <div className="flex-1">
                                                        <div className="flex justify-between text-sm mb-1.5">
                                                            <span className="font-medium text-neutral-700">Lab Tests</span>
                                                            <span className="font-semibold">{formatLKR(bill.lab_total)}</span>
                                                        </div>
                                                        <div className="ml-0 space-y-1 border-l-2 border-purple-100 pl-3">
                                                            {bill.lab_items.map((lt: any, i: number) => (
                                                                <div key={i} className="flex justify-between text-xs text-neutral-500">
                                                                    <span>{lt.name}</span>
                                                                    <span>{formatLKR(lt.price)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Medicines */}
                                            {bill.medicine_items?.length > 0 && (
                                                <div className="flex items-start gap-3">
                                                    <Pill className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                                    <div className="flex-1">
                                                        <div className="flex justify-between text-sm mb-1.5">
                                                            <span className="font-medium text-neutral-700">Medicines</span>
                                                            <span className="font-semibold">{formatLKR(bill.pharmacy_total)}</span>
                                                        </div>
                                                        <div className="space-y-1 border-l-2 border-emerald-100 pl-3">
                                                            {bill.medicine_items.map((m: any, i: number) => (
                                                                <div key={i} className="flex justify-between text-xs text-neutral-500">
                                                                    <span>{m.name} <span className="text-neutral-400">× {m.qty} {m.unit}</span></span>
                                                                    <span>{formatLKR(m.total)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Grand Total */}
                                        <div className="flex justify-between items-center pt-3 border-t font-bold">
                                            <span className="text-neutral-800">Total Payable</span>
                                            <span className="text-lg text-neutral-900">{formatLKR(bill.total_amount)}</span>
                                        </div>
                                    </CardContent>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
