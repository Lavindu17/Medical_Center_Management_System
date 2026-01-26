
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Pill, User, Clock } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default function PrescriptionsPage() {
    const [queue, setQueue] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchQueue();
    }, []);

    const fetchQueue = () => {
        fetch('/api/pharmacist/prescriptions')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setQueue(data);
                } else {
                    console.error('Failed to fetch queue:', data);
                    setQueue([]);
                }
            })
            .catch(err => {
                console.error(err);
                setQueue([]);
            })
            .finally(() => setLoading(false));
    };

    const filteredQueue = queue.filter(item =>
        item.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.doctor_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-neutral-900">Prescription Queue</h1>
                    <p className="text-neutral-500">Manage pending prescriptions and dispensing.</p>
                </div>
            </div>

            <div className="flex gap-4 mb-6">
                <div className="relative max-w-md flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                    <Input
                        placeholder="Search patient or doctor..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid gap-4">
                {loading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                    </div>
                ) : filteredQueue.length === 0 ? (
                    <div className="text-center p-12 bg-neutral-50 rounded-xl border border-dashed border-neutral-200">
                        <Pill className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-neutral-900">No Pending Prescriptions</h3>
                        <p className="text-neutral-500">Great job! The queue is empty.</p>
                    </div>
                ) : (
                    filteredQueue.map((item) => (
                        <div key={item.id} className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md transition-all flex justify-between items-center">
                            <div className="flex gap-6 items-center">
                                <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-lg">
                                    {item.patient_name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-neutral-900">{item.patient_name}</h3>
                                    <div className="flex items-center gap-4 text-sm text-neutral-500 mt-1">
                                        <span className="flex items-center gap-1">
                                            <User className="h-3 w-3" /> Dr. {item.doctor_name}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" /> {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 mb-1">
                                        {item.status}
                                    </Badge>
                                    <p className="text-xs text-neutral-500">{item.item_count} Items</p>
                                </div>
                                <Link href={`/pharmacist/dispense/${item.id}`}>
                                    <Button className="bg-emerald-600 hover:bg-emerald-700">
                                        Dispense
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
