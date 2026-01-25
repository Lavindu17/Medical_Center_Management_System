'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea'; // Assuming Textarea exists or use standard
import { CheckCircle2, ChevronRight, ChevronLeft, Search } from 'lucide-react';

interface Doctor {
    id: number;
    name: string;
    specialization: string;
    consultationFee: number;
}

interface Slot {
    time: string;
    available: boolean;
}

export default function BookAppointmentPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<any>(null);

    // Data
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
    const [slots, setSlots] = useState<Slot[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Selection
    const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedSlot, setSelectedSlot] = useState<string>('');
    const [reason, setReason] = useState<string>('');

    // Fetch User Session & Doctors on Mount
    useEffect(() => {
        // 1. Fetch Session
        fetch('/api/auth/session')
            .then(res => {
                if (res.ok) return res.json();
                // If not logged in, maybe redirect? For now, let fail gracefully or showing loading
            })
            .then(data => {
                if (data?.user) setUser(data.user);
            })
            .catch(console.error);

        // 2. Fetch Doctors
        async function fetchDoctors() {
            const res = await fetch('/api/admin/doctors');
            if (res.ok) {
                const data = await res.json();
                setDoctors(data);
                setFilteredDoctors(data);
            }
        }
        fetchDoctors();
    }, []);

    // Filter Doctors
    useEffect(() => {
        if (!searchQuery) {
            setFilteredDoctors(doctors);
        } else {
            const lower = searchQuery.toLowerCase();
            setFilteredDoctors(doctors.filter(d =>
                d.name.toLowerCase().includes(lower) ||
                d.specialization.toLowerCase().includes(lower)
            ));
        }
    }, [searchQuery, doctors]);


    // Fetch Slots when Date/Doctor changes
    useEffect(() => {
        if (selectedDoctor && selectedDate) {
            fetchSlots();
        }
    }, [selectedDoctor, selectedDate]);

    async function fetchSlots() {
        setLoading(true);
        setSlots([]);
        setSelectedSlot(''); // Reset selection
        try {
            const res = await fetch(`/api/doctors/availability?doctorId=${selectedDoctor?.id}&date=${selectedDate}`);
            if (res.ok) {
                const data = await res.json();
                // API now returns { time, available } objects
                setSlots(data.slots);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function submitBooking() {
        if (!user) {
            alert("You must be logged in to book.");
            return;
        }

        try {
            const res = await fetch('/api/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patientId: user.id, // Use dynamic ID
                    doctorId: selectedDoctor?.id,
                    date: selectedDate,
                    timeSlot: selectedSlot,
                    reason: reason // Send reason
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message);
            }

            const data = await res.json();
            router.push(`/patient?success=true&queue=${data.appointment.queueNumber}`);
        } catch (err: any) {
            alert(err.message);
        }
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Book Appointment</h1>
                <p className="text-neutral-500">Scheduled for: <span className="font-semibold text-blue-600">{user?.name || 'Guest'}</span></p>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center gap-2 mb-8 text-sm">
                <span className={`px-3 py-1 rounded-full ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-neutral-100'}`}>1. Doctor</span>
                <div className="h-0.5 w-8 bg-neutral-200" />
                <span className={`px-3 py-1 rounded-full ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-neutral-100'}`}>2. Date & Time</span>
                <div className="h-0.5 w-8 bg-neutral-200" />
                <span className={`px-3 py-1 rounded-full ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-neutral-100'}`}>3. Reason & Confirm</span>
            </div>

            <div className="grid gap-6">
                {step === 1 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Select a Doctor</CardTitle>
                            <CardDescription>Choose a specialist for your consultation.</CardDescription>

                            {/* Search Bar */}
                            <div className="relative mt-2">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
                                <Input
                                    type="search"
                                    placeholder="Search by name or specialization..."
                                    className="pl-9"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-2 gap-4 h-[400px] overflow-y-auto pr-2">
                            {filteredDoctors.length === 0 ? (
                                <div className="col-span-2 text-center py-8 text-neutral-500">
                                    No doctors found matching "{searchQuery}"
                                </div>
                            ) : (
                                filteredDoctors.map(doc => (
                                    <div
                                        key={doc.id}
                                        onClick={() => setSelectedDoctor(doc)}
                                        className={`p-4 rounded-lg border cursor-pointer transition-all hover:border-blue-500 hover:bg-blue-50
                        ${selectedDoctor?.id === doc.id ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-neutral-200'}
                      `}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                                DR
                                            </div>
                                            <div>
                                                <h3 className="font-semibold">{doc.name}</h3>
                                                <p className="text-sm text-neutral-500">{doc.specialization}</p>
                                                <div className="mt-2 text-xs font-mono bg-white inline-block px-1 rounded border">
                                                    Fee: ${doc.consultationFee}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                        <div className="p-6 border-t flex justify-end">
                            <Button disabled={!selectedDoctor} onClick={() => setStep(2)}>
                                Next Step <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </Card>
                )}

                {step === 2 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Select Date & Time</CardTitle>
                            <CardDescription>
                                Availability for Dr. {selectedDoctor?.name}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input
                                    type="date"
                                    min={new Date().toISOString().split('T')[0]}
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="max-w-[200px]"
                                />
                            </div>

                            {selectedDate && (
                                <div className="space-y-2">
                                    <Label>Select Time Slot (10 min)</Label>
                                    {loading ? (
                                        <div className="py-8 text-neutral-500">Loading slots...</div>
                                    ) : slots.length === 0 ? (
                                        <div className="py-8 text-neutral-500">No slots available (or closed).</div>
                                    ) : (
                                        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                                            {slots.map((slotObj, idx) => (
                                                <button
                                                    key={idx}
                                                    disabled={!slotObj.available}
                                                    onClick={() => slotObj.available && setSelectedSlot(slotObj.time)}
                                                    className={`py-2 px-1 text-sm rounded border text-center transition-colors
                                                      ${!slotObj.available
                                                            ? 'bg-red-50 text-red-500 border-red-200 cursor-not-allowed opacity-60'
                                                            : selectedSlot === slotObj.time
                                                                ? 'bg-blue-600 text-white border-blue-600'
                                                                : 'hover:border-blue-400 hover:bg-blue-50 bg-white'
                                                        }
                                                    `}
                                                    title={!slotObj.available ? 'Already Booked' : 'Available'}
                                                >
                                                    {slotObj.time}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex gap-4 text-xs mt-2">
                                        <div className="flex items-center gap-1"><div className="w-3 h-3 border rounded bg-white"></div> Available</div>
                                        <div className="flex items-center gap-1"><div className="w-3 h-3 border rounded bg-blue-600"></div> Selected</div>
                                        <div className="flex items-center gap-1"><div className="w-3 h-3 border rounded bg-red-50"></div> Booked</div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                        <div className="p-6 border-t flex justify-between">
                            <Button variant="outline" onClick={() => setStep(1)}>
                                <ChevronLeft className="mr-2 h-4 w-4" /> Back
                            </Button>
                            <Button disabled={!selectedDate || !selectedSlot} onClick={() => setStep(3)}>
                                Next: Details <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </Card>
                )}

                {step === 3 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Reason & Confirm</CardTitle>
                            <CardDescription>Please explain your visit regarding and review details.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Reason Input */}
                            <div className="space-y-2">
                                <Label htmlFor="reason">Reason for Visit (Symptoms, etc.)</Label>
                                <div className="relative">
                                    <textarea
                                        id="reason"
                                        className="flex min-h-[80px] w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-950 dark:ring-offset-neutral-950 dark:placeholder:text-neutral-400 dark:focus-visible:ring-neutral-300"
                                        placeholder="e.g. Severe headache, Fever since yesterday..."
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="bg-neutral-50 p-6 rounded-lg space-y-4 max-w-lg mx-auto border">
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-neutral-500">Doctor</span>
                                    <span className="font-semibold">{selectedDoctor?.name}</span>
                                </div>
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-neutral-500">Specialization</span>
                                    <span>{selectedDoctor?.specialization}</span>
                                </div>
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-neutral-500">Date</span>
                                    <span>{selectedDate}</span>
                                </div>
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-neutral-500">Time Slot</span>
                                    <span className="text-blue-600 font-bold">{selectedSlot}</span>
                                </div>
                                <div className="flex justify-between pt-2">
                                    <span className="text-neutral-500">Consultation Fee</span>
                                    <span className="font-mono text-lg">${selectedDoctor?.consultationFee}</span>
                                </div>
                            </div>
                        </CardContent>
                        <div className="p-6 border-t flex justify-between">
                            <Button variant="outline" onClick={() => setStep(2)}>
                                <ChevronLeft className="mr-2 h-4 w-4" /> Back
                            </Button>
                            <Button className="bg-green-600 hover:bg-green-700" onClick={submitBooking}>
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Confirm Booking
                            </Button>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}
