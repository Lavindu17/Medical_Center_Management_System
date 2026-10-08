'use client';

import { PageHeader } from '@/components/ui/page-header';


import { EmptyState, LoadingState } from '@/components/ui/state-views';

import { useState, useEffect } from 'react';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, User } from 'lucide-react';

export default function ReceptionistAppointments() {
    const confirm = useConfirm();
    const [appointments, setAppointments] = useState<any[]>([]);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [selectedDate, setSelectedDate] = useState(() => {
        const d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().split('T')[0];
    });
    const [selectedDoctor, setSelectedDoctor] = useState('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDoctors();
    }, []);

    useEffect(() => {
        fetchAppointments();
    }, [selectedDate, selectedDoctor]);

    const fetchDoctors = async () => {
        const res = await fetch('/api/receptionist/doctors');
        if (res.ok) setDoctors(await res.json());
    };

    const fetchAppointments = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/receptionist/appointments?date=${selectedDate}&doctorId=${selectedDoctor}`);
            if (res.ok) {
                setAppointments(await res.json());
            }
        } catch (e) {
            console.error(e);
            toast.error('Could not load this page. Please refresh and try again.');
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (id: number, status: string) => {
        const wording: Record<string, { title: string; description: string; confirmLabel: string; destructive?: boolean }> = {
            CHECKED_IN: { title: 'Check this patient in?', description: 'The doctor will be told the patient has arrived.', confirmLabel: 'Check in' },
            CANCELLED: { title: 'Cancel this appointment?', description: 'The patient and the doctor will be told, and the time slot opens up again.', confirmLabel: 'Cancel appointment', destructive: true },
            ABSENT: { title: 'Mark the patient as absent?', description: 'Use this when the patient did not attend.', confirmLabel: 'Mark absent', destructive: true },
            NO_SHOW: { title: 'Mark as no-show?', description: 'Use this when the patient did not attend.', confirmLabel: 'Mark no-show', destructive: true },
        };
        const text = wording[status] ?? { title: 'Update this appointment?', description: '', confirmLabel: 'Update' };
        if (!(await confirm({ ...text, cancelLabel: 'Go back' }))) return;
        try {
            const res = await fetch(`/api/receptionist/appointments/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                toast.success(status === 'CHECKED_IN' ? 'Patient checked in' : 'Appointment updated');
                fetchAppointments();
            } else {
                toast.error((await res.json().catch(() => null))?.message || 'Could not update this appointment.');
            }
        } catch (e) {
            console.error(e);
            toast.error('Could not update this appointment.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <PageHeader title="Appointments" description="Manage daily check-ins and schedules." />
                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                    <div className="w-full sm:w-48">
                        <Label htmlFor="f-date" className="text-xs mb-1 block">Date</Label>
                        <Input id="f-date" type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                    </div>
                    <div className="w-full sm:w-64">
                        <Label htmlFor="f-doctor" className="text-xs mb-1 block">Doctor</Label>
                        <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                            <SelectTrigger id="f-doctor">
                                <SelectValue placeholder="All Doctors" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Doctors</SelectItem>
                                {doctors.map(d => (
                                    <SelectItem key={d.id} value={d.id.toString()}>{d.name} ({d.specialization})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                </div>
            </div>

            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b bg-neutral-50 font-semibold text-sm text-neutral-500">
                    <div className="col-span-2">Time</div>
                    <div className="col-span-3">Patient</div>
                    <div className="col-span-3">Doctor</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2 text-right">Actions</div>
                </div>
                <div className="divide-y">
                    {loading ? <LoadingState label="Loading appointments…" /> : appointments.length === 0 ? <EmptyState title="No appointments on this day" description="Pick another date, or book a new appointment." action={{ label: 'Book appointment', href: '/receptionist/appointments/book' }} className="m-6 border-0" /> : appointments.map((appt) => (
                        <div key={appt.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-neutral-50 transition-colors">
                            <div className="col-span-2 flex flex-col">
                                <span className="font-medium text-neutral-900">{appt.time_slot}</span>
                                <span className="text-xs text-neutral-500">Q-{appt.queue_number}</span>
                            </div>
                            <div className="col-span-3">
                                <div className="font-medium">{appt.patient_name}</div>
                                <div className="text-xs text-neutral-500">{appt.patient_phone}</div>
                            </div>
                            <div className="col-span-3">
                                <div className="text-sm font-medium">{appt.doctor_name}</div>
                                <Badge variant="outline" className="text-xs font-normal bg-emerald-50 text-emerald-700 border-emerald-200">{appt.specialization}</Badge>
                            </div>
                            <div className="col-span-2">
                                <StatusBadge status={appt.status} size="sm" />
                            </div>
                            <div className="col-span-2 flex justify-end gap-2">
                                {appt.status === 'PENDING' && (
                                    <>
                                        <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => updateStatus(appt.id, 'CHECKED_IN')} title="Check In">
                                            <CheckCircle className="h-4 w-4 mr-1" /> Check In
                                        </Button>
                                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => updateStatus(appt.id, 'CANCELLED')} title="Cancel">
                                            <XCircle className="h-4 w-4" />
                                        </Button>
                                    </>
                                )}
                                {appt.status === 'CHECKED_IN' && (
                                    <span className="text-xs text-emerald-600 font-medium flex items-center">
                                        <Clock className="h-3 w-3 mr-1" /> Checked In
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
