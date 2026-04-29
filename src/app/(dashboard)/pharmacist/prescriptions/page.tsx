'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Pill, User, Clock, CalendarIcon, X } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function PrescriptionsPage() {
    const [queue, setQueue] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('active');
    const [selectedDate, setSelectedDate] = useState('');

    useEffect(() => {
        fetchQueue();
    }, [activeTab, selectedDate]);

    const fetchQueue = () => {
        setLoading(true);
        const params = new URLSearchParams({ tab: activeTab });
        if (selectedDate) params.append('date', selectedDate);

        fetch(`/api/pharmacist/prescriptions?${params.toString()}`)
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
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-neutral-900">Prescriptions</h1>
                    <p className="text-neutral-500">Manage dispensing and view history.</p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-[300px]">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="active">Active Queue</TabsTrigger>
                        <TabsTrigger value="passed">History</TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                        <Input
                            placeholder="Search patient or doctor..."
                            className="pl-9 h-10 bg-neutral-50"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="relative flex items-center">
                        <CalendarIcon className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                        <Input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="pl-9 h-10 w-[150px] bg-neutral-50 [&::-webkit-calendar-picker-indicator]:opacity-0"
                        />
                        {selectedDate && (
                            <button 
                                onClick={() => setSelectedDate('')}
                                className="absolute right-2 top-2.5 text-neutral-400 hover:text-neutral-600 bg-neutral-50 px-1"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
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
                        <h3 className="text-lg font-medium text-neutral-900">
                            {activeTab === 'active' ? 'No Pending Prescriptions' : 'No History Found'}
                        </h3>
                        <p className="text-neutral-500">
                            {activeTab === 'active' ? 'Great job! The queue is empty.' : 'Try adjusting your search or date filter.'}
                        </p>
                    </div>
                ) : (
                    filteredQueue.map((item) => (
                        <div key={item.id} className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm hover:border-emerald-200 hover:shadow-md transition-all flex justify-between items-center group">
                            <div className="flex gap-6 items-center">
                                <div className={`h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg ${activeTab === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-600'}`}>
                                    {item.patient_name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-neutral-900">{item.patient_name}</h3>
                                    <div className="flex items-center gap-4 text-sm text-neutral-500 mt-1">
                                        <span className="flex items-center gap-1">
                                            <User className="h-3 w-3" /> Dr. {item.doctor_name}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" /> {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <Badge variant="outline" className={`mb-1 ${
                                        item.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                        item.status === 'CANCELLED' ? 'bg-red-50 text-red-700 border-red-200' :
                                        'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}>
                                        {item.status}
                                    </Badge>
                                    <p className="text-xs text-neutral-500">{item.item_count} Items</p>
                                </div>
                                <Link href={`/pharmacist/dispense/${item.id}`}>
                                    {activeTab === 'active' ? (
                                        <Button className="bg-emerald-600 hover:bg-emerald-700">
                                            Dispense
                                        </Button>
                                    ) : (
                                        <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                                            View Details
                                        </Button>
                                    )}
                                </Link>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
