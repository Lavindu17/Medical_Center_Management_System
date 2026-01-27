'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Plus, Clock, User as UserIcon } from 'lucide-react';

interface Appointment {
    id: number;
    date: string;
    timeSlot: string;
    queueNumber: number;
    status: string;
    doctorName: string;
    specialization: string;
}

export default function PatientDashboard() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        // Fetch User Session for Greeting & ID
        fetch('/api/auth/session')
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('Unauthorized');
            })
            .then(data => {
                setUser(data.user);
                fetchAppointments(data.user.id); // Use actual dynamic ID
            })
            .catch(err => {
                console.error(err);
                // Redirect to login if needed? For now just log.
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
        a.status !== 'CANCELLED' &&
        new Date(a.date) >= new Date(new Date().setHours(0, 0, 0, 0))
    );

    const past = appointments.filter(a =>
        a.status === 'CANCELLED' ||
        (new Date(a.date) < new Date(new Date().setHours(0, 0, 0, 0)))
    );

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                        Hi {user?.name ? user.name : 'Patient'}, <span className="text-neutral-500 font-normal">Welcome back.</span>
                    </h1>
                    <p className="text-neutral-500 mt-1">Manage your appointments and view history.</p>
                </div>
                <Button asChild className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto h-11 md:h-10 transition-colors duration-200">
                    <Link href="/patient/book">
                        <Plus className="mr-2 h-4 w-4" /> Book New Appointment
                    </Link>
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                {/* Quick Stats / Profile Card - First on mobile, last on desktop */}
                <div className="space-y-6 order-first lg:order-last">
                    <Card className="bg-gradient-to-br from-blue-600 to-blue-800 text-white border-none">
                        <CardHeader>
                            <CardTitle className="text-white">Patient Profile</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="h-14 w-14 md:h-12 md:w-12 rounded-full bg-white/20 flex items-center justify-center">
                                    <UserIcon className="h-7 w-7 md:h-6 md:w-6 text-white" />
                                </div>
                                <div>
                                    <div className="font-bold text-lg">{user?.name || 'Loading...'}</div>
                                    <div className="text-blue-100 text-sm">Patient ID: #{user?.id || '...'}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 md:gap-2 text-center text-sm mt-4 pt-4 border-t border-white/20">
                                <div>
                                    <div className="font-bold text-2xl">{upcoming.length}</div>
                                    <div className="text-blue-100 text-xs">Upcoming</div>
                                </div>
                                <div>
                                    <div className="font-bold text-2xl">{past.length}</div>
                                    <div className="text-blue-100 text-xs">Completed</div>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-white/20">
                                <Button asChild variant="secondary" className="w-full h-10 md:h-9 text-blue-700 hover:text-blue-900 bg-white hover:bg-neutral-100 transition-colors duration-200">
                                    <Link href="/patient/profile">Edit My Profile</Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Upcoming Appointments */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-lg md:text-xl font-semibold flex items-center">
                        <Calendar className="mr-2 h-4 w-4 md:h-5 md:w-5 text-blue-600" /> Upcoming Visits
                    </h2>

                    {isLoading ? (
                        <div className="text-neutral-500">Loading appointments...</div>
                    ) : upcoming.length === 0 ? (
                        <Card className="bg-neutral-50 border-dashed">
                            <CardContent className="h-40 flex flex-col items-center justify-center text-neutral-500">
                                <p>No upcoming appointments.</p>
                                <Button variant="link" asChild><Link href="/patient/book">Book one now</Link></Button>
                            </CardContent>
                        </Card>
                    ) : (
                        upcoming.map(apt => (
                            <Card key={apt.id} className="border-l-4 border-l-blue-600 cursor-pointer hover:shadow-md transition-shadow duration-200">
                                <CardContent className="p-4 md:pt-6 flex flex-col sm:flex-row justify-between items-start gap-4">
                                    <div className="flex-1 w-full sm:w-auto">
                                        <h3 className="font-bold text-base md:text-lg">{apt.doctorName}</h3>
                                        <p className="text-sm text-neutral-500 mb-2">{apt.specialization}</p>
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-sm font-medium">
                                            <span className="flex items-center text-neutral-700">
                                                <Calendar className="mr-1 h-3 w-3" /> {new Date(apt.date).toLocaleDateString()}
                                            </span>
                                            <span className="flex items-center text-neutral-700">
                                                <Clock className="mr-1 h-3 w-3" /> {apt.timeSlot}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="w-full sm:w-auto flex sm:flex-col items-center gap-3 sm:gap-2 text-center bg-blue-50 p-3 rounded-lg sm:min-w-[80px]">
                                        <div className="flex-1 sm:flex-none">
                                            <div className="text-xs text-blue-600 uppercase font-bold mb-1">Queue</div>
                                            <div className="text-2xl font-bold text-blue-700">{apt.queueNumber}</div>
                                        </div>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            className="h-8 text-xs sm:h-6 sm:text-[10px] px-3 sm:w-full transition-colors duration-200"
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
                            </Card>
                        ))
                    )}

                    {/* Past History */}
                    <div className="pt-6 md:pt-8">
                        <h2 className="text-lg md:text-xl font-semibold mb-4 text-neutral-400">Appointment History</h2>
                        {past.length === 0 ? (
                            <p className="text-neutral-400 text-sm">No past history found.</p>
                        ) : (
                            <div className="space-y-3 md:space-y-4 opacity-60 md:opacity-75">
                                {past.map(apt => (
                                    <Card key={apt.id}>
                                        <CardContent className="py-3 px-4 md:py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm">
                                            <div>
                                                <span className="font-semibold block">{apt.doctorName}</span>
                                                <span className="text-neutral-500">{new Date(apt.date).toLocaleDateString()}</span>
                                            </div>
                                            <Badge variant={apt.status === 'CANCELLED' ? 'destructive' : 'secondary'}>{apt.status}</Badge>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
