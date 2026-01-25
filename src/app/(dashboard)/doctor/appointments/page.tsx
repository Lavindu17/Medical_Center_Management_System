'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarClock, CheckCircle2, XCircle, Play, User } from 'lucide-react';
import Link from 'next/link';

export default function DoctorAppointmentsPage() {
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        // Fetch User then Appointments
        fetch('/api/auth/session')
            .then(res => res.json())
            .then(data => {
                if (data?.user) {
                    setUser(data.user);
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

    const today = new Date().toISOString().split('T')[0];
    const todayAppointments = appointments.filter(a => a.date.startsWith(today));
    const upcomingAppointments = appointments.filter(a => a.date > today);
    // Debug: Show dates
    console.log('Today (UTC):', today);
    console.log('Appointments:', appointments.map(a => `${a.id}: ${a.date}`));

    // Need to fetch Patient Names? 
    // The GET /api/appointments might need enhancement to join 'patients' or 'users' table to get Patient Name.
    // Let's check api/appointments/route.ts from Step 695.
    // It joins doctors table but not patient details? 
    // Wait, let's looking at api/appointments/route.ts again.
    // "FROM appointments a JOIN doctors d ... JOIN users d_user ..."
    // It does NOT join patient! usage: `patientId` is in `a`.
    // We need PATIENT NAME. 

    // I will need to update the API key to fetch patient info.

    return (
        <div className="p-8 space-y-6 max-w-5xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Appointments</h1>
                    <p className="text-neutral-500">Manage your schedule and consultations.</p>
                </div>
                <div className="text-right">
                    <p className="text-xl font-mono font-bold text-blue-600">{today}</p>
                </div>
            </div>

            <Tabs defaultValue="all" className="w-full">
                <TabsList>
                    <TabsTrigger value="all">All ({appointments.length})</TabsTrigger>
                    <TabsTrigger value="today">Today ({todayAppointments.length})</TabsTrigger>
                    <TabsTrigger value="upcoming">Upcoming ({upcomingAppointments.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="space-y-4 py-4">
                    {loading ? <div>Loading...</div> : appointments.length === 0 ? (
                        <div className="text-neutral-500 text-center py-8">No appointments found.</div>
                    ) : (appointments.map((appt) => (
                        <AppointmentCard key={appt.id} appt={appt} />
                    )))}
                </TabsContent>

                <TabsContent value="today" className="space-y-4 py-4">
                    {loading ? <div>Loading...</div> : todayAppointments.length === 0 ? (
                        <div className="text-neutral-500 text-center py-8">No appointments for today.</div>
                    ) : (todayAppointments.map((appt) => (
                        <AppointmentCard key={appt.id} appt={appt} />
                    )))}
                </TabsContent>

                <TabsContent value="upcoming" className="space-y-4 py-4">
                    {loading ? <div>Loading...</div> : upcomingAppointments.length === 0 ? (
                        <div className="text-neutral-500 text-center py-8">No upcoming appointments.</div>
                    ) : (upcomingAppointments.map((appt) => (
                        <AppointmentCard key={appt.id} appt={appt} />
                    )))}
                </TabsContent>
            </Tabs>
        </div>
    );
}

function AppointmentCard({ appt }: { appt: any }) {
    // Determine status color
    const statusColor = {
        'PENDING': 'bg-yellow-100 text-yellow-700',
        'COMPLETED': 'bg-green-100 text-green-700',
        'CANCELLED': 'bg-red-100 text-red-700',
        'ABSENT': 'bg-gray-100 text-gray-700'
    }[appt.status as string] || 'bg-gray-100';

    return (
        <Card>
            <CardContent className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="text-center min-w-[80px]">
                        <div className="text-2xl font-bold text-blue-600">{appt.timeSlot}</div>
                        <div className="text-xs text-neutral-500 uppercase font-semibold">Queue #{appt.queueNumber}</div>
                    </div>

                    <div className="h-10 w-[1px] bg-neutral-200"></div>

                    <div>
                        {/* We need Patient Name here. Currently missing in API response potentially. */}
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg">{appt.patientName || `Patient #${appt.patient_id}`}</h3>
                            {/* ^ Fallback until API fixed */}
                        </div>
                        {appt.reason && (
                            <p className="text-sm text-neutral-600 mt-1 italic">"{appt.reason}"</p>
                        )}
                        <div className="mt-2">
                            <Badge variant="outline" className={statusColor}>{appt.status}</Badge>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {appt.status === 'PENDING' && (
                        <Link href={`/doctor/consultation/${appt.id}`}>
                            <Button className="bg-blue-600 hover:bg-blue-700">
                                <Play className="mr-2 h-4 w-4" /> Start
                            </Button>
                        </Link>
                    )}
                    {appt.status === 'COMPLETED' && (
                        <Button variant="outline" disabled>
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Completed
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
