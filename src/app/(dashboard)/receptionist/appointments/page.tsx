
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, User } from 'lucide-react';

export default function ReceptionistAppointments() {
    const [appointments, setAppointments] = useState<any[]>([]);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
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
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (id: number, status: string) => {
        if (!confirm(`Mark appointment as ${status}?`)) return;
        try {
            const res = await fetch(`/api/receptionist/appointments/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            if (res.ok) fetchAppointments();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-neutral-900">Appointments</h1>
                    <p className="text-neutral-500">Manage daily check-ins and schedules.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                    <div className="w-full sm:w-48">
                        <Label className="text-xs mb-1 block">Date</Label>
                        <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                    </div>
                    <div className="w-full sm:w-64">
                        <Label className="text-xs mb-1 block">Doctor</Label>
                        <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                            <SelectTrigger>
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
                    {loading ? <div className="p-8 text-center">Loading...</div> : appointments.length === 0 ? <div className="p-8 text-center text-neutral-500">No appointments found.</div> : appointments.map((appt) => (
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
                                <Badge variant="outline" className="text-xs font-normal bg-blue-50 text-blue-700 border-blue-200">{appt.specialization}</Badge>
                            </div>
                            <div className="col-span-2">
                                <Badge className={`
                                    ${appt.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' : ''}
                                    ${appt.status === 'ARRIVED' || appt.status === 'CHECKED_IN' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' : ''}
                                    ${appt.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800 hover:bg-blue-100' : ''}
                                    ${appt.status === 'CANCELLED' ? 'bg-red-100 text-red-800 hover:bg-red-100' : ''}
                                `}>
                                    {appt.status.replace('_', ' ')}
                                </Badge>
                            </div>
                            <div className="col-span-2 flex justify-end gap-2">
                                {appt.status === 'PENDING' && (
                                    <>
                                        <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => updateStatus(appt.id, 'ARRIVED')} title="Check In">
                                            <CheckCircle className="h-4 w-4 mr-1" /> Arrived
                                        </Button>
                                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => updateStatus(appt.id, 'CANCELLED')} title="Cancel">
                                            <XCircle className="h-4 w-4" />
                                        </Button>
                                    </>
                                )}
                                {appt.status === 'ARRIVED' && (
                                    <span className="text-xs text-emerald-600 font-medium flex items-center">
                                        <Clock className="h-3 w-3 mr-1" /> Waiting
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
