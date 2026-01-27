'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, ChevronRight, Play, Eye, Clock, CalendarDays, User } from 'lucide-react';
import Link from 'next/link';

export default function DoctorAppointmentsPage() {
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'today' | 'week' | 'month'>('today');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        // Fetch User and Appointments
        setLoading(true); // Ensure loading state resets on mount if needed
        fetch('/api/auth/session')
            .then(res => res.json())
            .then(data => {
                if (data?.user) {
                    return fetch(`/api/appointments?doctorId=${data.user.id}`, { cache: 'no-store' });
                }
                return Promise.reject('No user');
            })
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setAppointments(data);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const getFilteredAppointments = () => {
        const today = new Date();
        const todayStr = today.toLocaleDateString('en-CA');

        return appointments.filter(appt => {
            const apptDateStr = appt.date;

            // Search
            if (searchTerm) {
                if (apptDateStr.includes(searchTerm)) return true;
                if (appt.patientName && appt.patientName.toLowerCase().includes(searchTerm.toLowerCase())) return true;
                return false;
            }

            // Filter
            if (filter === 'today') return apptDateStr === todayStr;
            if (filter === 'week') {
                const d = new Date(appt.date);
                const t = new Date();
                const diffTime = Math.abs(t.getTime() - d.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays <= 7; // Approx 'week'
            }
            if (filter === 'month') {
                const d = new Date(appt.date);
                return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
            }
            return true;
        });
    };

    const filteredData = getFilteredAppointments();

    return (
        <div className="p-8 max-w-7xl mx-auto font-sans text-neutral-800 bg-gray-50/50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Appointments</h1>
                    <p className="text-neutral-500 mt-1">Manage patient queue and consultations.</p>
                </div>
                <div className="flex bg-white p-1 rounded-lg border shadow-sm">
                    {(['today', 'week', 'month'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filter === f
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-neutral-500 hover:text-neutral-900 hover:bg-gray-50'
                                }`}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Search */}
            <div className="mb-6 max-w-md">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <Input
                        placeholder="Search by Patient Name or Date..."
                        className="pl-9 bg-white border-neutral-200 focus:border-emerald-500 transition-colors"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Content */}
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-neutral-100 bg-neutral-50/50 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    <div className="col-span-1 text-center">Queue</div>
                    <div className="col-span-4">Patient</div>
                    <div className="col-span-2">Time</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-3 text-right">Action</div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-neutral-100">
                    {loading ? (
                        <div className="p-12 flex justify-center text-neutral-400">Loading...</div>
                    ) : filteredData.length === 0 ? (
                        <div className="p-16 flex flex-col items-center justify-center text-neutral-400 gap-2">
                            <CalendarDays className="h-10 w-10 text-neutral-200" />
                            <p>No appointments found.</p>
                        </div>
                    ) : (
                        filteredData.map((appt) => (
                            <div key={appt.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-emerald-50/30 transition-colors group">
                                {/* Queue Number */}
                                <div className="col-span-1 flex justify-center">
                                    <div className="h-8 w-8 rounded-full bg-neutral-100 text-neutral-600 font-bold flex items-center justify-center text-sm border border-neutral-200 group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">
                                        {appt.queueNumber}
                                    </div>
                                </div>

                                {/* Patient */}
                                <div className="col-span-4 flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0 border border-white shadow-sm">
                                        {appt.patientName ? appt.patientName.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-neutral-900 leading-tight">
                                            {appt.patientName || `Patient #${appt.patient_id}`}
                                        </div>
                                        <div className="text-xs text-neutral-500 truncate mt-0.5" title={appt.reason}>
                                            {appt.reason || 'Routine Checkup'}
                                        </div>
                                    </div>
                                </div>

                                {/* Time */}
                                <div className="col-span-2">
                                    <div className="flex items-center gap-1.5 text-neutral-900 font-medium text-sm">
                                        <Clock className="h-3.5 w-3.5 text-neutral-400" />
                                        {appt.timeSlot}
                                    </div>
                                    <div className="text-xs text-neutral-400 pl-5">{appt.date}</div>
                                </div>

                                {/* Status */}
                                <div className="col-span-2">
                                    <StatusPill status={appt.status} />
                                </div>

                                {/* Actions */}
                                <div className="col-span-3 flex justify-end gap-2">
                                    {/* Logic: 
                                        Pending -> Start(Disabled)
                                        CheckedIn -> Start
                                        Ongoing -> Resume
                                        Completed -> View
                                    */}
                                    {appt.status === 'PENDING' && (
                                        <Button size="sm" variant="ghost" disabled className="text-neutral-400 gap-2 h-8">
                                            <Play className="h-4 w-4" /> Start
                                        </Button>
                                    )}
                                    {appt.status === 'CHECKED_IN' && (
                                        <Link href={`/doctor/consultation/${appt.id}`}>
                                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-8 gap-2 px-4 transition-all hover:pr-5">
                                                <Play className="h-3.5 w-3.5 fill-current" /> Start
                                            </Button>
                                        </Link>
                                    )}
                                    {appt.status === 'ONGOING' && (
                                        <Link href={`/doctor/consultation/${appt.id}`}>
                                            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white shadow-sm h-8 gap-2 px-4">
                                                <Play className="h-3.5 w-3.5 fill-current" /> Resume
                                            </Button>
                                        </Link>
                                    )}
                                    {appt.status === 'COMPLETED' && (
                                        <Link href={`/doctor/consultation/${appt.id}`}>
                                            <Button size="sm" variant="secondary" className="text-neutral-600 hover:text-emerald-600 h-8 gap-2">
                                                <Eye className="h-4 w-4" /> View
                                            </Button>
                                        </Link>
                                    )}
                                    {(appt.status === 'CANCELLED' || appt.status === 'ABSENT') && (
                                        <span className="text-neutral-400 text-sm px-2">-</span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

function StatusPill({ status }: { status: string }) {
    // Dot + Text strategy
    let color = 'bg-gray-100 text-gray-500';
    let dot = 'bg-gray-400';
    let label = status;

    switch (status) {
        case 'PENDING':
            color = 'bg-yellow-50 text-yellow-700 border border-yellow-100';
            dot = 'bg-yellow-500';
            label = 'Pending';
            break;
        case 'CHECKED_IN':
            color = 'bg-green-50 text-green-700 border border-green-100';
            dot = 'bg-green-500 animate-pulse';
            label = 'Checked In';
            break;
        case 'ONGOING':
            color = 'bg-amber-50 text-amber-700 border border-amber-100';
            dot = 'bg-amber-500';
            label = 'Ongoing';
            break;
        case 'COMPLETED':
            color = 'bg-emerald-50 text-emerald-700 border border-emerald-100';
            dot = 'bg-emerald-500';
            label = 'Completed';
            break;
        case 'CANCELLED':
            color = 'bg-red-50 text-red-700 border border-red-100';
            dot = 'bg-red-400';
            label = 'Cancelled';
            break;
    }

    return (
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full w-fit ${color}`}>
            <span className={`h-2 w-2 rounded-full ${dot}`}></span>
            <span className="text-xs font-semibold">{label}</span>
        </div>
    )
}
