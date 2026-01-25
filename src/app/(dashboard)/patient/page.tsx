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

    const upcoming = appointments.filter(a => new Date(a.date) >= new Date(new Date().setHours(0, 0, 0, 0)));
    const past = appointments.filter(a => new Date(a.date) < new Date(new Date().setHours(0, 0, 0, 0)));

    return (
        <div className="p-8 space-y-8 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Hi {user?.name ? user.name : 'Patient'}, <span className="text-neutral-500 font-normal">Welcome back.</span>
                    </h1>
                    <p className="text-neutral-500 mt-1">Manage your appointments and view history.</p>
                </div>
                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                    <Link href="/patient/book">
                        <Plus className="mr-2 h-4 w-4" /> Book New Appointment
                    </Link>
                </Button>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {/* Upcoming Appointments */}
                <div className="md:col-span-2 space-y-4">
                    <h2 className="text-xl font-semibold flex items-center">
                        <Calendar className="mr-2 h-5 w-5 text-blue-600" /> Upcoming Visits
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
                            <Card key={apt.id} className="border-l-4 border-l-blue-600">
                                <CardContent className="pt-6 flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-lg">{apt.doctorName}</h3>
                                        <p className="text-sm text-neutral-500 mb-2">{apt.specialization}</p>
                                        <div className="flex items-center gap-4 text-sm font-medium">
                                            <span className="flex items-center text-neutral-700">
                                                <Calendar className="mr-1 h-3 w-3" /> {new Date(apt.date).toLocaleDateString()}
                                            </span>
                                            <span className="flex items-center text-neutral-700">
                                                <Clock className="mr-1 h-3 w-3" /> {apt.timeSlot}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-center bg-blue-50 p-3 rounded-lg min-w-[80px] flex flex-col gap-2">
                                        <div className="text-xs text-blue-600 uppercase font-bold mb-1">Queue</div>
                                        <div className="text-2xl font-bold text-blue-700">{apt.queueNumber}</div>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            className="h-6 text-[10px] w-full"
                                            onClick={async () => {
                                                if (!confirm('Cancel this appointment?')) return;
                                                await fetch('/api/appointments/cancel', {
                                                    method: 'PUT',
                                                    body: JSON.stringify({ appointmentId: apt.id })
                                                });
                                                fetchAppointments(3); // Refresh
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
                    <div className="pt-8">
                        <h2 className="text-xl font-semibold mb-4 text-neutral-400">Past History</h2>
                        {past.length === 0 ? (
                            <p className="text-neutral-400 text-sm">No past history found.</p>
                        ) : (
                            <div className="space-y-4 opacity-75">
                                {past.map(apt => (
                                    <Card key={apt.id}>
                                        <CardContent className="py-4 flex justify-between items-center text-sm">
                                            <div>
                                                <span className="font-semibold block">{apt.doctorName}</span>
                                                <span className="text-neutral-500">{new Date(apt.date).toLocaleDateString()}</span>
                                            </div>
                                            <Badge variant="secondary">{apt.status}</Badge>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Stats / Profile Card */}
                <div className="space-y-6">
                    <Card className="bg-gradient-to-br from-blue-600 to-blue-800 text-white border-none">
                        <CardHeader>
                            <CardTitle className="text-white">Patient Profile</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                                    <UserIcon className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <div className="font-bold text-lg">{user?.name || 'Loading...'}</div>
                                    <div className="text-blue-100 text-sm">Patient ID: #{user?.id || '...'}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-center text-sm mt-4 pt-4 border-t border-white/20">
                                <div>
                                    <div className="font-bold text-2xl">{upcoming.length}</div>
                                    <div className="text-blue-100 text-xs">Upcoming</div>
                                </div>
                                <div>
                                    <div className="font-bold text-2xl">{past.length}</div>
                                    <div className="text-blue-100 text-xs">Completed</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
