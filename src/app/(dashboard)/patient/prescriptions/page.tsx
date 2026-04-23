'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Pill, Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
            .catch(console.error)
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
        <div className="p-8 space-y-6 max-w-5xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold">My Prescriptions</h1>
                <p className="text-neutral-500">History of medication issued by doctors.</p>
            </div>

            {loading ? <div>Loading...</div> : prescriptions.length === 0 ? (
                <div className="text-neutral-500">No prescriptions found.</div>
            ) : (
                <div className="space-y-4">
                    {prescriptions.map((prescription: any) => (
                        <Card key={prescription.id} className="overflow-hidden">
                            {/* Prescription Header (Clickable) */}
                            <div 
                                className="p-6 cursor-pointer hover:bg-neutral-50 flex items-center justify-between transition-colors"
                                onClick={() => togglePrescription(prescription.id)}
                            >
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-emerald-100 rounded-lg text-emerald-600 block">
                                        <Pill className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg">Prescription #{prescription.id}</h3>
                                        <div className="text-sm text-neutral-500 mt-1">
                                            Dr. {prescription.doctorName} <span className="mx-1">•</span> {prescription.specialization}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-right">
                                    <div className="hidden sm:block">
                                        <Badge variant={prescription.status === 'DISPENSED' ? 'default' : 'secondary'} className={prescription.status === 'DISPENSED' ? 'bg-emerald-100 text-emerald-800' : ''}>
                                            {prescription.status}
                                        </Badge>
                                        <div className="text-sm text-neutral-500 mt-1 flex items-center justify-end gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {new Date(prescription.issued_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="text-neutral-400">
                                        {expandedPrescriptions[prescription.id] ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                    </div>
                                </div>
                            </div>

                            {/* Prescription Items (Collapsible) */}
                            {expandedPrescriptions[prescription.id] && (
                                <div className="border-t bg-neutral-50/50 p-6">
                                    <h4 className="font-semibold text-sm text-neutral-500 mb-4 uppercase tracking-wider">Prescribed Medications</h4>
                                    <div className="space-y-4">
                                        {prescription.items.map((item: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-start bg-white p-4 border rounded-lg shadow-sm">
                                                <div>
                                                    <h5 className="font-bold text-emerald-700">{item.medicineName}</h5>
                                                    <div className="flex flex-wrap gap-2 sm:gap-4 text-sm text-neutral-600 mt-1">
                                                        <span className="font-medium text-neutral-800">Dose:</span> {item.dosage}
                                                        <span className="hidden sm:inline">•</span>
                                                        <span className="font-medium text-neutral-800">Frequency:</span> {item.frequency}
                                                        <span className="hidden sm:inline">•</span>
                                                        <span className="font-medium text-neutral-800">Duration:</span> {item.duration}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-xs text-neutral-500 block mb-1">Qty</span>
                                                    <span className="font-bold text-lg">{item.quantity}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
