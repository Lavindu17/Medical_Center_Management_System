'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Calendar, Plus, Clock, User as UserIcon, CalendarX, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface Appointment {
    id: number;
    date: string;
    timeSlot: string;
    queueNumber: number;
    status: string;
    doctorName: string;
    specialization: string;
}

const fadeUp = {
    hidden: { opacity: 0, y: 16 },
    show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.3 } }),
};

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        SCHEDULED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        COMPLETED: 'bg-neutral-100 text-neutral-600 border-neutral-200',
        CANCELLED: 'bg-red-50 text-red-600 border-red-200',
        IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
    };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[status] ?? 'bg-neutral-100 text-neutral-600 border-neutral-200'}`}>
            {status}
        </span>
    );
}

export default function PatientDashboard() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        fetch('/api/auth/session')
            .then(res => { if (res.ok) return res.json(); throw new Error('Unauthorized'); })
            .then(data => {
                setUser(data.user);
                fetchAppointments(data.user.id);
            })
            .catch(console.error);
    }, []);

    async function fetchAppointments(patientId: number) {
        try {
            const res = await fetch(`/api/appointments?patientId=${patientId}`);
            if (res.ok) setAppointments(await res.json());
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }

    const upcoming = appointments.filter(a =>
        a.status !== 'CANCELLED' && new Date(a.date) >= new Date(new Date().setHours(0, 0, 0, 0))
    );
    const past = appointments.filter(a =>
        a.status === 'CANCELLED' || new Date(a.date) < new Date(new Date().setHours(0, 0, 0, 0))
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-neutral-900">
                        Hi, <span className="text-emerald-600">{user?.name ?? '…'}</span>
                    </h1>
                    <p className="text-neutral-500 mt-0.5 text-sm">Here's your health dashboard.</p>
                </div>
                <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 gap-2 shadow-sm">
                    <Link href="/patient/book">
                        <Plus className="h-4 w-4" /> Book Appointment
                    </Link>
                </Button>
            </motion.div>

            {/* KPI row */}
            <div className="grid grid-cols-2 gap-3">
                {[
                    { label: 'Upcoming', value: isLoading ? '—' : upcoming.length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Past / Cancelled', value: isLoading ? '—' : past.length, color: 'text-neutral-500', bg: 'bg-neutral-100' },
                ].map((kpi, i) => (
                    <motion.div key={kpi.label} custom={i} variants={fadeUp} initial="hidden" animate="show">
                        <Card className="border border-neutral-200 shadow-none">
                            <CardContent className="p-4">
                                <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide">{kpi.label}</p>
                                <p className={`text-3xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                            </CardContent>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Upcoming Appointments */}
            <div>
                <h2 className="text-base font-semibold text-neutral-900 flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4 text-emerald-600" /> Upcoming Visits
                </h2>

                {isLoading ? (
                    <div className="space-y-3">
                        {[0, 1, 2].map(i => <SkeletonCard key={i} lines={3} />)}
                    </div>
                ) : upcoming.length === 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                        <Card className="border-dashed border-2 border-neutral-200 bg-white shadow-none">
                            <CardContent className="py-14 flex flex-col items-center gap-3 text-center">
                                <div className="h-12 w-12 rounded-full bg-neutral-100 flex items-center justify-center">
                                    <CalendarX className="h-5 w-5 text-neutral-400" />
                                </div>
                                <p className="text-neutral-500 text-sm">No upcoming appointments</p>
                                <Button asChild size="sm" variant="outline" className="gap-2 mt-1">
                                    <Link href="/patient/book">Book one now <ArrowRight className="h-3 w-3" /></Link>
                                </Button>
                            </CardContent>
                        </Card>
                    </motion.div>
                ) : (
                    <div className="space-y-3">
                        {upcoming.map((apt, i) => (
                            <motion.div key={apt.id} custom={i} variants={fadeUp} initial="hidden" animate="show">
                                <Card className="border border-neutral-200 shadow-none hover:shadow-sm transition-shadow duration-200 overflow-hidden">
                                    <div className="flex">
                                        {/* Left accent + queue */}
                                        <div className="w-[72px] bg-emerald-600 flex flex-col items-center justify-center gap-1 py-4 flex-shrink-0">
                                            <span className="text-[10px] text-emerald-100 uppercase font-semibold tracking-widest">Queue</span>
                                            <span className="text-2xl font-bold text-white">{apt.queueNumber}</span>
                                        </div>
                                        {/* Content */}
                                        <CardContent className="flex-1 py-4 px-4 flex flex-col sm:flex-row justify-between gap-3">
                                            <div>
                                                <h3 className="font-semibold text-neutral-900">{apt.doctorName}</h3>
                                                <p className="text-xs text-neutral-400 mb-2">{apt.specialization}</p>
                                                <div className="flex flex-wrap gap-3 text-xs text-neutral-600">
                                                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-emerald-500" />{new Date(apt.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                                                    <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-emerald-500" />{apt.timeSlot}</span>
                                                </div>
                                            </div>
                                            <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-2">
                                                <StatusBadge status={apt.status} />
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-xs text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                                                    onClick={async () => {
                                                        if (!confirm('Cancel this appointment?')) return;
                                                        await fetch('/api/appointments/cancel', {
                                                            method: 'PUT',
                                                            body: JSON.stringify({ appointmentId: apt.id })
                                                        });
                                                        if (user?.id) fetchAppointments(user.id);
                                                    }}
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Past History */}
            {!isLoading && past.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                    <h2 className="text-base font-semibold text-neutral-400 mb-3">Appointment History</h2>
                    <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white shadow-none">
                        {past.map((apt, i) => (
                            <div key={apt.id} className={`flex items-center justify-between px-4 py-3 text-sm ${i < past.length - 1 ? 'border-b border-neutral-100' : ''} hover:bg-neutral-50 transition-colors`}>
                                <div>
                                    <span className="font-medium text-neutral-700">{apt.doctorName}</span>
                                    <span className="text-neutral-400 ml-2 text-xs">{new Date(apt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                </div>
                                <StatusBadge status={apt.status} />
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
        </div>
    );
}
