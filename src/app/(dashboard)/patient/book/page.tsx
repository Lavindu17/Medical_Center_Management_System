'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, User, CheckCircle2, Search, ArrowRight, ArrowLeft, ChevronLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function PatientBookAppointment() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [step, setStep] = useState(1);

    // Data State
    const [doctors, setDoctors] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Selection State
    const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
    const [date, setDate] = useState('');
    const [slots, setSlots] = useState<{ time: string, status: 'available' | 'booked' }[]>([]);
    const [selectedSlot, setSelectedSlot] = useState('');
    const [reason, setReason] = useState('');

    // Loading States
    const [isLoading, setIsLoading] = useState(false);
    const [loadingSlots, setLoadingSlots] = useState(false);

    // 1. Fetch User Session
    useEffect(() => {
        fetch('/api/auth/session')
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('Unauthorized');
            })
            .then(data => setUser(data.user))
            .catch(() => router.push('/login'));
    }, [router]);

    // 2. Fetch Doctors
    useEffect(() => {
        fetch('/api/doctors')
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data)) setDoctors(data);
            })
            .catch(err => console.error(err));
    }, []);

    // 3. Fetch Slots
    useEffect(() => {
        if (selectedDoctor && date) {
            fetchAvailability();
        } else {
            setSlots([]);
        }
    }, [selectedDoctor, date]);

    const fetchAvailability = async () => {
        setLoadingSlots(true);
        try {
            // Updated to use the smart availability API that respects Doctor's custom schedule & leaves
            const res = await fetch(`/api/appointments/availability?doctorId=${selectedDoctor.id}&date=${date}`);

            if (res.ok) {
                const data = await res.json();
                // data.slots is { time: string, status: 'available'|'booked' }[]
                if (data.slots) {
                    setSlots(data.slots);
                } else {
                    setSlots([]);
                }
            } else {
                console.error("Failed to fetch slots");
                setSlots([]);
            }
        } catch (error) {
            console.error(error);
            setSlots([]);
        } finally {
            setLoadingSlots(false);
        }
    };

    const handleBook = async () => {
        if (!user || !selectedDoctor || !date || !selectedSlot) return;
        setIsLoading(true);

        try {
            const res = await fetch('/api/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patientId: user.id,
                    doctorId: Number(selectedDoctor.id),
                    date,
                    timeSlot: selectedSlot,
                    reason
                })
            });

            const data = await res.json();

            if (res.ok) {
                router.push('/patient?booking=success');
            } else {
                alert(data.message || 'Booking failed');
            }
        } catch (error) {
            console.error(error);
            alert('Something went wrong');
        } finally {
            setIsLoading(false);
        }
    };

    const nextStep = () => setStep(s => s + 1);
    const prevStep = () => setStep(s => s - 1);

    const filteredDoctors = doctors.filter(d =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.specialization.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">

            {/* Header / Progress */}
            <div className="flex items-center gap-4">
                {step > 1 && (
                    <Button variant="ghost" size="icon" onClick={prevStep}>
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                )}
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        {step === 1 ? 'Choose a Doctor' : step === 2 ? 'Select Schedule' : 'Confirm Booking'}
                    </h1>
                    <div className="flex gap-2 mt-1">
                        {[1, 2, 3].map(i => (
                            <div key={i} className={`h-1.5 w-8 rounded-full ${step >= i ? 'bg-blue-600' : 'bg-neutral-200'}`} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Step 1: Doctor Selection */}
            {step === 1 && (
                <div className="space-y-4 animate-in slide-in-from-right-4 fade-in">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                        <Input
                            placeholder="Search by name or specialization..."
                            className="pl-9 h-11"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {filteredDoctors.map(doctor => (
                            <div
                                key={doctor.id}
                                onClick={() => { setSelectedDoctor(doctor); nextStep(); }}
                                className="border rounded-lg p-4 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all bg-white group"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                                            {doctor.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-neutral-900 group-hover:text-blue-700">{doctor.name}</h3>
                                            <p className="text-sm text-neutral-500">{doctor.specialization}</p>
                                        </div>
                                    </div>
                                    <div className="text-neutral-300 group-hover:text-blue-500">
                                        <ArrowRight className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="mt-3 flex items-center gap-2 text-xs text-neutral-400">
                                    <Badge variant="secondary" className="font-normal text-neutral-500 bg-neutral-100">
                                        Fee: $ {doctor.consultation_fee}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Step 2: Date & Time */}
            {step === 2 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">

                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle className="text-base">Selected Doctor</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                                    {selectedDoctor?.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-neutral-900">{selectedDoctor?.name}</h3>
                                    <p className="text-sm text-neutral-500">{selectedDoctor?.specialization}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-2">
                        <Label>Select Date</Label>
                        <Input
                            type="date"
                            className="h-12 text-lg"
                            min={new Date().toISOString().split('T')[0]}
                            value={date}
                            onChange={e => { setDate(e.target.value); setSelectedSlot(''); }}
                        />
                    </div>

                    {date && (
                        <div className="space-y-2">
                            <Label>Select Time Slot</Label>
                            {loadingSlots ? (
                                <div className="p-8 text-center text-neutral-500">Checking availability...</div>
                            ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                    {slots.map(slot => (
                                        <Button
                                            key={slot.time}
                                            variant={selectedSlot === slot.time ? 'default' : 'outline'}
                                            disabled={slot.status === 'booked'}
                                            onClick={() => setSelectedSlot(slot.time)}
                                            className={`
                                                ${slot.status === 'booked'
                                                    ? 'bg-red-50 text-red-300 border-red-100 hover:bg-red-50 hover:text-red-300'
                                                    : selectedSlot === slot.time
                                                        ? 'bg-blue-600 hover:bg-blue-700'
                                                        : ''}
                                            `}
                                        >
                                            {slot.time}
                                        </Button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="pt-4 flex justify-end">
                        <Button onClick={nextStep} disabled={!selectedSlot} className="w-full sm:w-auto bg-blue-600">
                            Continue <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Step 3: Confirmation */}
            {step === 3 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
                    <Card>
                        <CardHeader>
                            <CardTitle>Review Details</CardTitle>
                            <CardDescription>Double check your appointment information.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-neutral-500">Doctor</span>
                                    <div className="font-medium text-lg">{selectedDoctor?.name}</div>
                                </div>
                                <div>
                                    <span className="text-neutral-500">Date</span>
                                    <div className="font-medium text-lg">{new Date(date).toLocaleDateString()}</div>
                                </div>
                                <div>
                                    <span className="text-neutral-500">Time</span>
                                    <div className="font-medium text-lg">{selectedSlot}</div>
                                </div>
                                <div>
                                    <span className="text-neutral-500">Fee</span>
                                    <div className="font-medium text-lg">$ {selectedDoctor?.consultation_fee}</div>
                                </div>
                            </div>

                            <div className="pt-4 border-t">
                                <Label className="mb-2 block">Reason for Visit (Optional)</Label>
                                <Input
                                    placeholder="Briefly describe your symptoms..."
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                />
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button
                                className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg"
                                onClick={handleBook}
                                disabled={isLoading}
                            >
                                {isLoading ? 'Confirming...' : 'Confirm Appointment'}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            )}

        </div>
    );
}
