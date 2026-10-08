
'use client';
import { PageHeader } from '@/components/ui/page-header';
import { toast } from 'sonner';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Search, UserCheck, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function ReceptionistBookAppointment() {
    const router = useRouter();

    // Step 1: Select Patient
    const [patientSearch, setPatientSearch] = useState('');
    const [patients, setPatients] = useState<any[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<any>(null);

    // Step 2: Select Doctor & Date
    const [doctors, setDoctors] = useState<any[]>([]);
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const [date, setDate] = useState('');
    const [slots, setSlots] = useState<string[]>([]);
    const [selectedSlot, setSelectedSlot] = useState('');
    const [loadingSlots, setLoadingSlots] = useState(false);

    // Fetch Patients
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (patientSearch.length > 2) {
                const res = await fetch(`/api/receptionist/patients?q=${patientSearch}`);
                if (res.ok) setPatients(await res.json());
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [patientSearch]);

    // Fetch Doctors
    useEffect(() => {
        fetch('/api/receptionist/doctors').then(r => r.json()).then(setDoctors);
    }, []);

    // Fetch Slots
    useEffect(() => {
        if (selectedDoctor && date) {
            fetchSlots();
        }
    }, [selectedDoctor, date]);

    const fetchSlots = async () => {
        setLoadingSlots(true);
        try {
            // Using the public generic slot API or creating a new internal one?
            // The existing /api/doctors/[id]/slots seems reusable if public.
            // Let's assume /api/users/doctors/[id]/slots or similar.
            // Wait, we have 'backend01': API for Doctor Slots. Where is it?
            // It was likely /api/patient/doctors/[id]/slots. I should check. 
            // Reuse logic: Front end can calculate or fetch availability.
            // For simplicity, let's just implement a direct fetch here:
            // Actually, let's create a quick API fetch or reuse the logic inside the component if simple (8-5).
            // But we need to check booked slots.
            // Let's use the new endpoint I'll make: /api/receptionist/doctors/[id]/slots?date=...
            // Or reuse /api/receptionist/appointments?date=...&doctorId=... to find taken slots and subtract.

            // Slots come from the doctor's real schedule, leave days and existing bookings
            const res = await fetch(`/api/doctors/availability?doctorId=${selectedDoctor}&date=${date}`);
            const data = res.ok ? await res.json() : { slots: [] };
            setSlots((data.slots || []).filter((s: any) => s.available).map((s: any) => s.time));

        } catch (e) {
            console.error(e);
        } finally {
            setLoadingSlots(false);
        }
    };

    const handleBook = async () => {
        if (!selectedPatient || !selectedDoctor || !date || !selectedSlot) return;

        try {
            const res = await fetch('/api/receptionist/appointments/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patient_id: selectedPatient.id,
                    doctor_id: selectedDoctor,
                    date,
                    time_slot: selectedSlot
                })
            });

            if (res.ok) {
                toast.success('Appointment Booked!');
                router.push('/receptionist/appointments');
            } else {
                toast.error('Booking Failed');
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <PageHeader back={{ href: '/receptionist/appointments', label: 'Appointments' }} title="Book Appointment" description="Choose a patient, a doctor and a time." />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left: Patient Selection */}
                <div className="space-y-6">
                    <Card>
                        <CardContent className="pt-6">
                            <h2 className="font-semibold mb-4 flex items-center"><UserCheck className="mr-2 h-4 w-4" /> Select Patient</h2>
                            {!selectedPatient ? (
                                <div className="space-y-4">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                                        <Input
                                            placeholder="Search patient..."
                                            className="pl-9"
                                            value={patientSearch}
                                            onChange={e => setPatientSearch(e.target.value)}
                                        />
                                    </div>
                                    <div tabIndex={0} role="region" aria-label="Matching patients" className="border rounded-md max-h-60 overflow-y-auto divide-y">
                                        {patients.map(p => (
                                            <div
                                                key={p.id}
                                                className="p-3 hover:bg-neutral-50 cursor-pointer text-sm"
                                                onClick={() => setSelectedPatient(p)}
                                            >
                                                <div className="font-medium">{p.name}</div>
                                                <div className="text-neutral-500 text-xs">{p.phone} | {p.email}</div>
                                            </div>
                                        ))}
                                        {patients.length === 0 && <div className="p-4 text-center text-xs text-neutral-400">Search to find patients</div>}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-bold text-emerald-800">{selectedPatient.name}</div>
                                            <div className="text-sm text-emerald-600">{selectedPatient.phone}</div>
                                        </div>
                                        <Button variant="ghost" size="sm" className="text-emerald-700 hover:text-emerald-900" onClick={() => setSelectedPatient(null)}>Change</Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right: Doctor & Slot */}
                <div className="space-y-6">
                    <Card>
                        <CardContent className="pt-6 space-y-4">
                            <h2 className="font-semibold mb-4 flex items-center"><Calendar className="mr-2 h-4 w-4" /> Appointment Details</h2>

                            <div className="space-y-2">
                                <Label htmlFor="f-select-doctor">Select Doctor</Label>
                                <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                                    <SelectTrigger id="f-select-doctor"><SelectValue placeholder="Choose Doctor" /></SelectTrigger>
                                    <SelectContent>
                                        {doctors.map(d => (
                                            <SelectItem key={d.id} value={d.id.toString()}>{d.name} ({d.specialization})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="f-date">Date</Label>
                                <Input id="f-date" type="date" value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
                            </div>

                            {selectedDoctor && date && (
                                <div className="space-y-2">
                                    <Label>Available Slots</Label>
                                    {loadingSlots ? <div className="text-sm text-neutral-500">Loading slots...</div> : (
                                        <div className="grid grid-cols-4 gap-2">
                                            {slots.map(slot => (
                                                <Button
                                                    key={slot}
                                                    variant={selectedSlot === slot ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => setSelectedSlot(slot)}
                                                    className={selectedSlot === slot ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                                                >
                                                    {slot}
                                                </Button>
                                            ))}
                                            {slots.length === 0 && <span className="col-span-4 text-sm text-red-500">No slots available</span>}
                                        </div>
                                    )}
                                </div>
                            )}

                            <Button className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700" disabled={!selectedPatient || !selectedDoctor || !date || !selectedSlot} onClick={handleBook}>
                                Confirm Booking
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
