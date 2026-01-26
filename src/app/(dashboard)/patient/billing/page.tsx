'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatLKR } from '@/lib/utils';

export default function BillingPage() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/patient/records?patientId=3&type=bills')
            .then(res => res.json())
            .then(setData)
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="p-8 space-y-6 max-w-5xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold">Billing History</h1>
                <p className="text-neutral-500">View your invoices and payment status.</p>
            </div>

            {loading ? <div>Loading...</div> : data.length === 0 ? (
                <div className="text-neutral-500">No bills found.</div>
            ) : (
                <div className="grid gap-4">
                    {data.map((item, i) => (
                        <Card key={i}>
                            <CardContent className="pt-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-lg">Invoice #{item.id}</h3>
                                        <div className="text-sm text-neutral-500">
                                            {new Date(item.appointmentDate).toLocaleDateString()} • Dr. {item.doctorName}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-xl">{formatLKR(item.total_amount)}</div>
                                        <Badge variant={item.status === 'PAID' ? 'default' : 'destructive'}>
                                            {item.status}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="border-t pt-4 text-sm grid grid-cols-2 gap-2 text-neutral-600">
                                    <div className="flex justify-between">
                                        <span>Doctor Fee</span>
                                        <span>{formatLKR(item.doctor_fee)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Pharmacy</span>
                                        <span>{formatLKR(item.pharmacy_total)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Lab Charges</span>
                                        <span>{formatLKR(item.lab_total)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Service Charge</span>
                                        <span>{formatLKR(item.service_charge)}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
