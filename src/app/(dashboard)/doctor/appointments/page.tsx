'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function DoctorAppointmentsPage() {
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'today' | 'week' | 'month' | 'year'>('today');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        // Fetch User then Appointments
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
                // Determine status logic if needed, currently API gives status
                if (Array.isArray(data)) setAppointments(data);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const getFilteredAppointments = () => {
        const today = new Date();
        const todayStr = today.toLocaleDateString('en-CA'); // YYYY-MM-DD local

        return appointments.filter(appt => {
            const apptDate = new Date(appt.date); // appt.date is YYYY-MM-DD string
            const apptDateStr = appt.date;

            // 1. Search Logic (Date or Name)
            if (searchTerm) {
                // If specific date entered/selected
                if (apptDateStr.includes(searchTerm)) return true;
                // If name search
                if (appt.patientName && appt.patientName.toLowerCase().includes(searchTerm.toLowerCase())) return true;
                return false;
            }

            // 2. Filter Logic
            if (filter === 'today') {
                return apptDateStr === todayStr;
            }
            if (filter === 'week') {
                // Simple logic: Is date within this week (Sunday to Saturday) containing today?
                // Or next 7 days? Let's do "Current Week"
                const firstDayOfWeek = new Date(today);
                firstDayOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
                const lastDayOfWeek = new Date(today);
                lastDayOfWeek.setDate(today.getDate() + (6 - today.getDay())); // Saturday

                // Compare times (reset hours to avoid mismatches)
                firstDayOfWeek.setHours(0, 0, 0, 0);
                lastDayOfWeek.setHours(23, 59, 59, 999);
                apptDate.setHours(12, 0, 0, 0); // set to middle of day to be safe

                return apptDate >= firstDayOfWeek && apptDate <= lastDayOfWeek;
            }
            if (filter === 'month') {
                return apptDate.getMonth() === today.getMonth() && apptDate.getFullYear() === today.getFullYear();
            }
            if (filter === 'year') {
                return apptDate.getFullYear() === today.getFullYear();
            }
            return true;
        });
    };

    const filteredData = getFilteredAppointments();

    return (
        <div className="p-8 max-w-7xl mx-auto font-sans text-neutral-800">
            {/* Header Section */}
            <div className="mb-6">
                <p className="text-sm text-neutral-500 font-medium">Sethro Medical Center</p>
                <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900">Appointments</h1>
            </div>

            {/* Search Bar */}
            <div className="flex gap-2 mb-6 bg-gray-50 p-2 rounded-lg">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                    <Input
                        type="text"
                        placeholder="Enter Date (YYYY-MM-DD) or Patient Name"
                        className="pl-10 h-12 bg-transparent border-none shadow-none text-lg placeholder:text-neutral-400 focus-visible:ring-0"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button className="h-12 px-8 bg-green-500 hover:bg-green-600 text-white font-bold rounded-md">
                    Search
                </Button>
            </div>

            {/* Filters */}
            <div className="flex gap-4 mb-8">
                <FilterButton active={filter === 'today'} onClick={() => setFilter('today')}>Today</FilterButton>
                <FilterButton active={filter === 'week'} onClick={() => setFilter('week')}>This Week</FilterButton>
                <FilterButton active={filter === 'month'} onClick={() => setFilter('month')}>This Month</FilterButton>
                <FilterButton active={filter === 'year'} onClick={() => setFilter('year')}>This Year</FilterButton>
            </div>

            {/* Appointment Table */}
            <div className="border rounded-xl overflow-hidden shadow-sm bg-white">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 p-4 border-b bg-white text-sm font-bold text-neutral-900">
                    <div className="col-span-1">No</div>
                    <div className="col-span-3">Patient Name</div>
                    <div className="col-span-2">Timeslot</div>
                    <div className="col-span-4">Reason to visit</div>
                    <div className="col-span-2">Status</div>
                </div>

                {/* Table Body */}
                <div className="bg-white">
                    {loading ? (
                        <div className="p-8 text-center text-neutral-500">Loading appointments...</div>
                    ) : filteredData.length === 0 ? (
                        <div className="p-12 text-center">
                            <p className="text-neutral-400 mb-2">No appointments found for this filter.</p>
                        </div>
                    ) : (
                        filteredData.map((appt) => (
                            <div key={appt.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-0 hover:bg-neutral-50 transition-colors items-center">
                                <div className="col-span-1 font-mono text-neutral-500">
                                    {appt.queueNumber.toString().padStart(2, '0')}
                                </div>
                                <div className="col-span-3 font-semibold text-neutral-900">
                                    {appt.patientName || `Patient #${appt.patient_id}`}
                                </div>
                                <div className="col-span-2">
                                    <div className="font-bold text-neutral-800">{appt.timeSlot}</div>
                                    <div className="text-xs text-neutral-400">{appt.date}</div>
                                </div>
                                <div className="col-span-4 text-sm text-neutral-600 truncate pr-4" title={appt.reason}>
                                    {appt.reason || '-'}
                                </div>
                                <div className="col-span-2 flex items-center justify-between">
                                    <StatusBadge status={appt.status} />
                                    {appt.status === 'PENDING' && (
                                        <Link href={`/doctor/consultation/${appt.id}`}>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-neutral-400 hover:text-blue-600">
                                                <ChevronRight className="h-5 w-5" />
                                            </Button>
                                        </Link>
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

function FilterButton({ active, children, onClick }: { active: boolean, children: React.ReactNode, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`
                px-6 py-2 rounded-lg font-medium text-sm transition-all border
                ${active
                    ? 'bg-green-500 text-white border-green-500 shadow-sm'
                    : 'bg-white text-green-600 border-green-600 hover:bg-green-50'
                }
            `}
        >
            {children}
        </button>
    )
}

function StatusBadge({ status }: { status: string }) {
    const styles = {
        'PENDING': 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100',
        'COMPLETED': 'bg-blue-100 text-blue-700 hover:bg-blue-100',
        'CANCELLED': 'bg-red-100 text-red-700 hover:bg-red-100',
        'ABSENT': 'bg-gray-100 text-gray-700 hover:bg-gray-100',
    }[status] || 'bg-gray-100 text-gray-700';

    return (
        <Badge variant="secondary" className={`${styles} border-none`}>
            {status}
        </Badge>
    )
}
