
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
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
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
    }, [startDate, endDate, selectedDoctor]);

    const fetchDoctors = async () => {
        const res = await fetch('/api/receptionist/doctors');
        if (res.ok) setDoctors(await res.json());
    };

    const fetchAppointments = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/receptionist/appointments?startDate=${startDate}&endDate=${endDate}&doctorId=${selectedDoctor}`);
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
        <div className="space-y-8 max-w-7xl mx-auto pb-12 px-4">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-extrabold text-neutral-900 tracking-tight">Appointments</h1>
                    <p className="text-neutral-500 mt-1 font-medium">Manage daily check-ins and patient schedules.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm">
                    <div className="flex gap-3 w-full sm:w-auto">
                        <div className="space-y-1.5 flex-1 sm:flex-none">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Start Date</Label>
                            <Input 
                                type="date" 
                                className="h-10 bg-neutral-50 border-neutral-200 focus:bg-white transition-all duration-200 rounded-xl"
                                value={startDate} 
                                max={endDate}
                                onChange={e => {
                                    setStartDate(e.target.value);
                                    if (e.target.value > endDate) setEndDate(e.target.value);
                                }} 
                            />
                        </div>
                        <div className="space-y-1.5 flex-1 sm:flex-none">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 ml-1">End Date</Label>
                            <Input 
                                type="date" 
                                className="h-10 bg-neutral-50 border-neutral-200 focus:bg-white transition-all duration-200 rounded-xl"
                                value={endDate} 
                                min={startDate}
                                onChange={e => {
                                    setEndDate(e.target.value);
                                    if (e.target.value < startDate) setStartDate(e.target.value);
                                }} 
                            />
                        </div>
                    </div>
                    <div className="w-full sm:w-64 space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Doctor</Label>
                        <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                            <SelectTrigger className="h-10 bg-neutral-50 border-neutral-200 focus:bg-white transition-all duration-200 rounded-xl">
                                <SelectValue placeholder="All Doctors" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-neutral-100 shadow-xl">
                                <SelectItem value="all">All Doctors</SelectItem>
                                {doctors.map(d => (
                                    <SelectItem key={d.id} value={d.id.toString()}>{d.name} ({d.specialization})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-neutral-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-8 py-5 border-b bg-neutral-50/30 font-bold text-[11px] uppercase tracking-[0.15em] text-neutral-400">
                    <div className="col-span-2">Date & Time</div>
                    <div className="col-span-3">Patient Details</div>
                    <div className="col-span-3">Assigned Doctor</div>
                    <div className="col-span-2 text-center">Status</div>
                    <div className="col-span-2 text-right px-2">Actions</div>
                </div>
                <div className="divide-y divide-neutral-50">
                    {loading ? (
                        <div className="p-32 text-center flex flex-col items-center gap-4">
                            <div className="relative h-10 w-10">
                                <div className="absolute inset-0 border-4 border-neutral-100 rounded-full" />
                                <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                            <span className="text-neutral-400 font-bold text-xs uppercase tracking-widest">Refreshing Data</span>
                        </div>
                    ) : appointments.length === 0 ? (
                        <div className="p-32 text-center">
                            <div className="bg-neutral-50 h-16 w-16 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3">
                                <User className="h-7 w-7 text-neutral-200" />
                            </div>
                            <p className="text-neutral-400 font-bold text-sm uppercase tracking-wider">No active appointments</p>
                            <p className="text-neutral-300 text-xs mt-1">Try adjusting your filters or date range.</p>
                        </div>
                    ) : appointments.map((appt) => (
                        <div key={appt.id} className="grid grid-cols-12 gap-4 px-8 py-6 items-center hover:bg-neutral-50/50 transition-all duration-300 group">
                            <div className="col-span-2 flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                    {new Date(appt.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                                <span className="text-lg font-black text-neutral-900 leading-tight tracking-tight">{appt.time_slot}</span>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <div className="h-1 w-1 rounded-full bg-emerald-500" />
                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter italic">Queue #{appt.queue_number}</span>
                                </div>
                            </div>
                            <div className="col-span-3 flex flex-col gap-0.5">
                                <div className="font-bold text-neutral-900 group-hover:text-emerald-600 transition-colors duration-300 text-base">{appt.patient_name}</div>
                                <div className="text-xs text-neutral-500 font-semibold tracking-tight">{appt.patient_phone}</div>
                            </div>
                            <div className="col-span-3 flex flex-col gap-2">
                                <div className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-full bg-neutral-100 flex items-center justify-center text-[10px] font-black text-neutral-400">
                                        {appt.doctor_name.charAt(0)}
                                    </div>
                                    {appt.doctor_name}
                                </div>
                                <div className="text-[9px] font-black uppercase tracking-[0.1em] text-neutral-400 bg-neutral-50 border border-neutral-100 w-fit px-2.5 py-1 rounded-lg">
                                    {appt.specialization}
                                </div>
                            </div>
                            <div className="col-span-2 flex justify-center">
                                <div className={`
                                    px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.12em] border shadow-sm
                                    ${appt.status === 'PENDING' ? 'bg-white border-amber-100 text-amber-600 shadow-amber-100/20' : ''}
                                    ${appt.status === 'CHECKED_IN' ? 'bg-white border-sky-100 text-sky-600 shadow-sky-100/20' : ''}
                                    ${appt.status === 'COMPLETED' ? 'bg-white border-emerald-100 text-emerald-600 shadow-emerald-100/20' : ''}
                                    ${appt.status === 'CANCELLED' ? 'bg-white border-rose-100 text-rose-600 shadow-rose-100/20' : ''}
                                `}>
                                    {appt.status.replace('_', ' ')}
                                </div>
                            </div>
                            <div className="col-span-2 flex justify-end gap-2">
                                {appt.status === 'PENDING' && (
                                    <div className="flex gap-2">
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="h-10 px-5 border-emerald-100 text-emerald-600 font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 hover:text-white hover:border-emerald-600 rounded-xl transition-all duration-300 shadow-sm" 
                                            onClick={() => updateStatus(appt.id, 'CHECKED_IN')}
                                        >
                                            <CheckCircle className="h-3.5 w-3.5 mr-2" /> Check In
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="h-10 w-10 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-300" 
                                            onClick={() => updateStatus(appt.id, 'CANCELLED')}
                                        >
                                            <XCircle className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                                {appt.status === 'CHECKED_IN' && (
                                    <div className="flex items-center gap-3 px-5 py-2.5 bg-emerald-50/50 text-emerald-600 rounded-xl border border-emerald-100/50 group-hover:bg-emerald-50 group-hover:border-emerald-200 transition-all duration-300">
                                        <div className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Active Check-In</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
