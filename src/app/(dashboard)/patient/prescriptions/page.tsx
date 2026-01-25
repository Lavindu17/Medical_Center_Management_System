'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Pill, Calendar } from 'lucide-react';

export default function PrescriptionsPage() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Hardcoded ID 3 for now
        fetch('/api/patient/records?patientId=3&type=prescriptions')
            .then(res => res.json())
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="p-8 space-y-6 max-w-5xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold">My Prescriptions</h1>
                <p className="text-neutral-500">History of medication issued by doctors.</p>
            </div>

            {loading ? <div>Loading...</div> : data.length === 0 ? (
                <div className="text-neutral-500">No prescriptions found.</div>
            ) : (
                <div className="grid gap-4">
                    {/* Note: SQL returns flat list of items. Ideally we group by Prescription ID. 
                 For simplicity, we just list items or simple grouping. */}
                    {data.map((item, i) => (
                        <Card key={i}>
                            <CardContent className="pt-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-lg text-blue-700">{item.medicineName}</h3>
                                        <div className="flex gap-4 text-sm text-neutral-600 mt-1">
                                            <span>{item.dosage}</span>
                                            <span>•</span>
                                            <span>{item.frequency}</span>
                                            <span>•</span>
                                            <span>{item.duration}</span>
                                        </div>
                                    </div>
                                    <div className="text-right text-sm">
                                        <div className="font-semibold">{item.doctorName}</div>
                                        <div className="text-neutral-500">{new Date(item.issued_at).toLocaleDateString()}</div>
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
