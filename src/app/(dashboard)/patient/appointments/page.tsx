'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Calendar, Clock, ChevronRight, CalendarX, ArrowRight, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Appointment {
    id: number;
    date: string;
    timeSlot: string;
    queueNumber: number;
    status: string;
    doctorName: string;
    specialization: string;
}

function StatusPill({ status }: { status: string }) {
    const map: Record<string, string> = {
        SCHEDULED:    'bg-emerald-50 text-emerald-700 border-emerald-200',
        COMPLETED:    'bg-neutral-100 text-neutral-500 border-neutral-200',
        CANCELLED:    'bg-red-50 text-red-600 border-red-200',
        IN_PROGRESS:  'bg-amber-50 text-amber-700 border-amber-200',
        CHECKED_IN:   'bg-teal-50 text-teal-700 border-teal-200',
    };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${map[status] ?? 'bg-neutral-100 text-neutral-500 border-neutral-200'}`}>
            {status.replace('_', ' ')}
        </span>
    );
}

const fadeUp = {
    hidden: { opacity: 0, y: 14 },
    show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.28 } }),
};

function AppointmentCard({ apt, isPast = false, index = 0 }: { apt: Appointment; isPast?: boolean; index?: number }) {
    return (
        <motion.div custom={index} variants={fadeUp} initial="hidden" animate="show">
            <Link href={`/patient/appointments/${apt.id}`} className="block group">
                <Card className={`transition-all duration-200 overflow-hidden group-hover:shadow-md ${isPast ? 'opacity-70 hover:opacity-90' : 'hover:border-emerald-400'}`}>
                    <div className="flex">
                        {/* Accent bar */}
                        <div className={`w-1.5 flex-shrink-0 ${isPast ? 'bg-neutral-200' : 'bg-emerald-500'}`} />

                        <CardContent className="flex-1 p-4 flex flex-col sm:flex-row justify-between items-start gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <h3 className="font-semibold text-neutral-900 text-base">{apt.doctorName}</h3>
                                    <StatusPill status={apt.status} />
                                </div>
                                <p className="text-xs text-neutral-400 mb-2">{apt.specialization}</p>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600">
                                    <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3 text-emerald-500" />
                                        {new Date(apt.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3 text-emerald-500" />
                                        {apt.timeSlot}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                {!isPast && (
                                    <div className="flex flex-col items-center bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-2 min-w-[64px] text-center">
                                        <span className="text-[9px] text-emerald-600 uppercase font-bold tracking-widest mb-0.5">Queue</span>
                                        <span className="text-xl font-bold text-emerald-700">{apt.queueNumber}</span>
                                    </div>
                                )}
                                <ChevronRight className="h-4 w-4 text-neutral-300 group-hover:text-emerald-500 transition-colors ml-auto sm:ml-0" />
                            </div>
                        </CardContent>
                    </div>
                </Card>
            </Link>
        </motion.div>
    );
}

export default function AppointmentsListPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming');

    useEffect(() => {
        fetch('/api/auth/session')
            .then(res => res.ok ? res.json() : Promise.reject('Unauthorized'))
            .then(data => { setUser(data.user); fetchAppointments(data.user.id); })
            .catch(err => { console.error(err); setIsLoading(false); });
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

    const shown = tab === 'upcoming' ? upcoming : past;

    return (
        <div className="space-y-6 max-w-3xl">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-neutral-900">My Appointments</h1>
                    <p className="text-neutral-500 mt-0.5 text-sm">View and manage your upcoming and past visits.</p>
                </div>
                <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 gap-2 shadow-sm">
                    <Link href="/patient/book"><Plus className="h-4 w-4" /> Book New</Link>
                </Button>
            </motion.div>

            {/* Tab Pills */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.25 }}
                className="flex gap-1 p-1 bg-neutral-100 rounded-lg w-fit"
            >
                {(['upcoming', 'history'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 capitalize ${tab === t
                            ? 'bg-white text-neutral-900 shadow-sm'
                            : 'text-neutral-500 hover:text-neutral-700'
                        }`}
                    >
                        {t === 'upcoming' ? `Upcoming` : 'History'}
                        {!isLoading && (
                            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full font-semibold ${tab === t ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-200 text-neutral-500'}`}>
                                {t === 'upcoming' ? upcoming.length : past.length}
                            </span>
                        )}
                    </button>
                ))}
            </motion.div>

            {/* List */}
            {isLoading ? (
                <div className="space-y-3">
                    {[0, 1, 2, 3].map(i => <SkeletonCard key={i} lines={3} />)}
                </div>
            ) : shown.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                    <Card className="border-dashed border-2 border-neutral-200 bg-white shadow-none">
                        <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
                            <div className="h-12 w-12 rounded-full bg-neutral-100 flex items-center justify-center">
                                <CalendarX className="h-5 w-5 text-neutral-400" />
                            </div>
                            <p className="text-neutral-500 text-sm">
                                {tab === 'upcoming' ? 'No upcoming appointments.' : 'No past appointment history.'}
                            </p>
                            {tab === 'upcoming' && (
                                <Button asChild size="sm" variant="outline" className="gap-2 mt-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                                    <Link href="/patient/book">Book an Appointment <ArrowRight className="h-3 w-3" /></Link>
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            ) : (
                <AnimatePresence mode="wait">
                    <div key={tab} className="space-y-3">
                        {shown.map((apt, i) => (
                            <AppointmentCard key={apt.id} apt={apt} isPast={tab === 'history'} index={i} />
                        ))}
                    </div>
                </AnimatePresence>
            )}
        </div>
    );
}
