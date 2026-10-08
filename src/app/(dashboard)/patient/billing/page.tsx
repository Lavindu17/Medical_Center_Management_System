'use client';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from 'sonner';
import { EmptyState } from '@/components/ui/state-views';
import { PageHeader } from '@/components/ui/page-header';
import { formatDate } from '@/lib/dates';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatLKR } from '@/lib/utils';
import { Stethoscope, FlaskConical, Pill, Receipt, ChevronDown, ChevronUp } from 'lucide-react';
import { asDoctor } from '@/lib/names';

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
            .catch((e) => { console.error(e); toast.error('Could not load this page. Please refresh and try again.'); })
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div role="status" className="py-16 text-center text-neutral-500">Loading billing history…</div>;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <PageHeader title="Billing" description="Itemized invoices for all your appointments." />

            {data.length === 0 ? (
                <EmptyState icon={Receipt} title="No bills yet" description="A bill appears here after each completed appointment." />
            ) : (
                <div className="space-y-4">
                    {data.map((bill) => {
                        const isExpanded = expandedId === bill.id;
                        const isPaid = bill.status === 'PAID';
                        return (
                            <Card key={bill.id} className={`border transition-shadow ${isPaid ? 'border-emerald-100' : 'border-amber-100'}`}>
                                {/* Invoice header: one big tap target. Amount on its own line so nothing is squeezed on a phone */}
                                <button
                                    type="button"
                                    aria-expanded={isExpanded}
                                    onClick={() => setExpandedId(isExpanded ? null : bill.id)}
                                    className="flex w-full items-center gap-3 p-4 text-left active:bg-neutral-50 sm:gap-4 sm:p-5"
                                >
                                    <span className={`hidden h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg sm:flex ${isPaid ? 'bg-emerald-50' : 'bg-amber-50'}`} aria-hidden>
                                        <Receipt className={`h-5 w-5 ${isPaid ? 'text-emerald-700' : 'text-amber-700'}`} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex flex-wrap items-center gap-2">
                                            <span className="font-bold text-neutral-900">Invoice #{bill.id}</span>
                                            <StatusBadge status={bill.status} kind="bill" size="sm" />
                                        </span>
                                        <span className="mt-0.5 block text-sm text-neutral-600">
                                            {formatDate(bill.appointmentDate)} · {asDoctor(bill.doctorName)}
                                        </span>
                                        <span className="mt-1.5 flex items-baseline gap-2">
                                            <span className="text-xl font-bold text-neutral-900 tabular">{formatLKR(bill.total_amount)}</span>
                                            {bill.paid_at && <span className="text-xs text-neutral-500">Paid {formatDate(bill.paid_at)}</span>}
                                        </span>
                                    </span>
                                    {isExpanded ? <ChevronUp className="h-5 w-5 flex-shrink-0 text-neutral-500" aria-hidden /> : <ChevronDown className="h-5 w-5 flex-shrink-0 text-neutral-500" aria-hidden />}
                                    <span className="sr-only">{isExpanded ? 'Hide itemised charges' : 'Show itemised charges'}</span>
                                </button>

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
                                                    <p className="text-xs text-neutral-400">{asDoctor(bill.doctorName)} · {bill.specialization}</p>
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
