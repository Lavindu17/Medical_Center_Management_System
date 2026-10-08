'use client';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from 'sonner';
import { EmptyState, LoadingState } from '@/components/ui/state-views';
import { PageHeader } from '@/components/ui/page-header';
import { formatDate } from '@/lib/dates';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Pill, Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { asDoctor } from '@/lib/names';

export default function PrescriptionsPage() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [expandedPrescriptions, setExpandedPrescriptions] = useState<Record<number, boolean>>({});

    useEffect(() => {
        fetch('/api/auth/session')
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('Unauthorized');
            })
            .then(data => {
                setUser(data.user);
                return fetch(`/api/patient/records?patientId=${data.user.id}&type=prescriptions`);
            })
            .then(res => res.json())
            .then(setData)
            .catch((e) => { console.error(e); toast.error('Could not load this page. Please refresh and try again.'); })
            .finally(() => setLoading(false));
    }, []);

    // Group items by Prescription ID
    const groupedPrescriptions = data.reduce((acc: any, item: any) => {
        if (!acc[item.id]) {
            acc[item.id] = {
                id: item.id,
                status: item.status,
                issued_at: item.issued_at,
                doctorName: item.doctorName,
                specialization: item.specialization,
                items: []
            };
        }
        acc[item.id].items.push(item);
        return acc;
    }, {});

    const prescriptions = Object.values(groupedPrescriptions).sort((a: any, b: any) => 
        new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime()
    );

    const togglePrescription = (id: number) => {
        setExpandedPrescriptions(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <PageHeader title="My Prescriptions" description="History of medication issued by doctors." />

            {loading ? <LoadingState label="Loading your prescriptions…" /> : prescriptions.length === 0 ? (
                <EmptyState title="No prescriptions yet" description="Medicines your doctor prescribes after a consultation will be listed here." />
            ) : (
                <div className="space-y-4">
                    {prescriptions.map((prescription: any) => (
                        <Card key={prescription.id} className="overflow-hidden">
                            <button
                                type="button"
                                aria-expanded={Boolean(expandedPrescriptions[prescription.id])}
                                onClick={() => togglePrescription(prescription.id)}
                                className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-neutral-50 active:bg-neutral-100 sm:gap-4 sm:p-5"
                            >
                                <span className="hidden h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 sm:flex" aria-hidden>
                                    <Pill className="h-5 w-5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="flex flex-wrap items-center gap-2">
                                        <span className="font-bold text-neutral-900">Prescription #{prescription.id}</span>
                                        <StatusBadge status={prescription.status} kind="prescription" size="sm" />
                                    </span>
                                    <span className="mt-0.5 block text-sm text-neutral-600">
                                        {asDoctor(prescription.doctorName)}{prescription.specialization ? ` · ${prescription.specialization}` : ''}
                                    </span>
                                    <span className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-500">
                                        <Calendar className="h-3.5 w-3.5" aria-hidden /> {formatDate(prescription.issued_at)}
                                        <span aria-hidden>·</span> {prescription.items.length} {prescription.items.length === 1 ? 'medicine' : 'medicines'}
                                    </span>
                                </span>
                                {expandedPrescriptions[prescription.id]
                                    ? <ChevronDown className="h-5 w-5 flex-shrink-0 text-neutral-500" aria-hidden />
                                    : <ChevronRight className="h-5 w-5 flex-shrink-0 text-neutral-500" aria-hidden />}
                                <span className="sr-only">{expandedPrescriptions[prescription.id] ? 'Hide medicines' : 'Show medicines'}</span>
                            </button>

                            {expandedPrescriptions[prescription.id] && (
                                <div className="border-t bg-neutral-50/60 p-4 sm:p-5">
                                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-600">Prescribed medicines</h3>
                                    <ul className="space-y-3">
                                        {prescription.items.map((item: any, idx: number) => (
                                            <li key={idx} className="rounded-xl border bg-white p-4 shadow-sm">
                                                <div className="flex items-start justify-between gap-3">
                                                    <p className="font-bold text-emerald-800">{item.medicineName}</p>
                                                    <p className="flex-shrink-0 rounded-md bg-neutral-100 px-2 py-0.5 text-sm font-semibold text-neutral-800">Qty {item.quantity}</p>
                                                </div>
                                                <dl className="mt-2.5 grid grid-cols-3 gap-2 text-sm">
                                                    {[['Dose', item.dosage], ['How often', item.frequency], ['For', item.duration]].map(([label, value]) => (
                                                        <div key={label}>
                                                            <dt className="text-xs text-neutral-500">{label}</dt>
                                                            <dd className="font-medium text-neutral-900">{value}</dd>
                                                        </div>
                                                    ))}
                                                </dl>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
