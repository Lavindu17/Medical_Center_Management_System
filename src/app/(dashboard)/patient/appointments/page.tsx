'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, ChevronRight } from 'lucide-react';

interface Appointment {
    id: number;
    date: string;
    timeSlot: string;
    queueNumber: number;
    status: string;
    doctorName: string;
    specialization: string;
}

export default function AppointmentsListPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        fetch('/api/auth/session')
            .then(res => res.ok ? res.json() : Promise.reject('Unauthorized'))
            .then(data => {
                setUser(data.user);
                fetchAppointments(data.user.id);
            })
            .catch(err => {
                console.error(err);
                setIsLoading(false);
            });
    }, []);

    async function fetchAppointments(patientId: number) {
        try {
            const res = await fetch(`/api/appointments?patientId=${patientId}`);
            if (res.ok) {
                const data = await res.json();
                setAppointments(data);
            }
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

    const AppointmentCard = ({ apt, isPast = false }: { apt: Appointment, isPast?: boolean }) => (
        <Card className={`hover:shadow-md transition-shadow duration-200 overflow-hidden cursor-pointer ${!isPast ? 'border-l-4 border-l-emerald-600' : ''}`}>
            <Link href={`/patient/appointments/${apt.id}`} className="block">
                <CardContent className={`p-4 md:pt-6 flex flex-col sm:flex-row justify-between items-start gap-4 ${isPast ? 'opacity-75' : ''}`}>
                    <div className="flex-1 w-full sm:w-auto">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-base md:text-lg">{apt.doctorName}</h3>
                            <Badge variant={apt.status === 'CANCELLED' ? 'destructive' : isPast ? 'secondary' : 'default'} className={!isPast && apt.status !== 'CANCELLED' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : ''}>
                                {apt.status}
                            </Badge>
                        </div>
                        <p className="text-sm text-neutral-500 mb-2">{apt.specialization}</p>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-sm font-medium">
                            <span className="flex items-center text-neutral-700">
                                <Calendar className="mr-1 h-4 w-4 text-emerald-600" /> {new Date(apt.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className="flex items-center text-neutral-700">
                                <Clock className="mr-1 h-4 w-4 text-emerald-600" /> {apt.timeSlot}
                            </span>
                        </div>
                    </div>
                    {!isPast && (
                        <div className="w-full sm:w-auto flex flex-col items-center gap-2 text-center bg-emerald-50 p-3 rounded-lg sm:min-w-[80px]">
                            <div className="text-xs text-emerald-600 uppercase font-bold">Queue</div>
                            <div className="text-2xl font-bold text-emerald-700">{apt.queueNumber}</div>
                        </div>
                    )}
                    <div className="self-center mt-2 sm:mt-0 text-neutral-400 hover:text-neutral-600 hidden sm:block">
                        <ChevronRight className="h-6 w-6" />
                    </div>
                </CardContent>
            </Link>
        </Card>
    );

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">My Appointments</h1>
                <p className="text-neutral-500 mt-1">View and manage your upcoming and past medical visits.</p>
            </div>

            {isLoading ? (
                <div className="text-neutral-500 animate-pulse">Loading appointments...</div>
            ) : (
                <div className="space-y-8">
                    {/* Upcoming Section */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold flex items-center border-b pb-2">
                            Upcoming Visits
                            <Badge variant="secondary" className="ml-2 rounded-full">{upcoming.length}</Badge>
                        </h2>
                        {upcoming.length === 0 ? (
                            <div className="bg-neutral-50 border border-dashed rounded-lg p-8 text-center text-neutral-500 flex flex-col items-center">
                                <Calendar className="h-10 w-10 text-neutral-300 mb-3" />
                                <p>You have no upcoming appointments.</p>
                                <Button asChild variant="outline" className="mt-4 border-emerald-600 text-emerald-600 hover:bg-emerald-50">
                                    <Link href="/patient/book">Book an Appointment</Link>
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {upcoming.map(apt => (
                                    <AppointmentCard key={apt.id} apt={apt} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Past Section */}
                    <div className="space-y-4 pt-4">
                        <h2 className="text-xl font-semibold flex items-center border-b pb-2 text-neutral-600">
                            Past History
                            <Badge variant="outline" className="ml-2 rounded-full">{past.length}</Badge>
                        </h2>
                        {past.length === 0 ? (
                            <p className="text-neutral-500 text-sm italic">No past appointments found.</p>
                        ) : (
                            <div className="space-y-3">
                                {past.map(apt => (
                                    <AppointmentCard key={apt.id} apt={apt} isPast />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
