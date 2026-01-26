'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, User, CheckCircle2 } from 'lucide-react';

export default function PatientBookAppointment() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);

    // Form State
    const [doctors, setDoctors] = useState<any[]>([]);
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const [date, setDate] = useState('');
    const [slots, setSlots] = useState<string[]>([]);
    const [selectedSlot, setSelectedSlot] = useState('');
    const [reason, setReason] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingSlots, setLoadingSlots] = useState(false);

    // 1. Fetch User Session
    useEffect(() => {
        fetch('/api/auth/session')
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('Unauthorized');
            })
            .then(data => {
                setUser(data.user);
                // Redirect if not patient?
            })
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

    // 3. Fetch Slots when Doctor & Date selected
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
            // Fetch all appointments for this doctor to find taken slots
            // Ideally backend should handle date filtering, but generic endpoint returns all
            const res = await fetch(`/api/appointments?doctorId=${selectedDoctor}`);
            if (res.ok) {
                const appointments = await res.json();

                // Filter for selected date
                const takenSlots = appointments
                    .filter((a: any) => a.date === date && a.status !== 'CANCELLED')
                    .map((a: any) => a.timeSlot);

                // Generate 9 AM - 5 PM slots
                const allSlots = [];
                let start = 9 * 60; // 9:00
                const end = 17 * 60; // 17:00
                while (start < end) {
                    const h = Math.floor(start / 60);
                    const m = start % 60;
                    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                    allSlots.push(timeStr);
                    start += 15; // 15 min intervals
                }

                setSlots(allSlots.filter(s => !takenSlots.includes(s)));
            }
        } catch (error) {
            console.error(error);
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
                    doctorId: Number(selectedDoctor),
                    date,
                    timeSlot: selectedSlot,
                    reason
                })
            });

            const data = await res.json();

            if (res.ok) {
                // Success
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

    return (
        <div className="max-w-3xl mx-auto p-6 space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Book Appointment</h1>
                <p className="text-neutral-500">Schedule a visit with one of our doctors.</p>
            </div>

            <div className="grid gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Appointment Details</CardTitle>
                        <CardDescription>Please select a doctor and a suitable time.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">

                        {/* Doctor Selection */}
                        <div className="space-y-2">
                            <Label>Select Doctor</Label>
                            <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose a doctor" />
                                </SelectTrigger>
                                <SelectContent>
                                    {doctors.map(d => (
                                        <SelectItem key={d.id} value={d.id.toString()}>
                                            {d.name} <span className="text-neutral-400 text-xs ml-2">({d.specialization})</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Date Selection */}
                        <div className="space-y-2">
                            <Label>Date</Label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                                <Input
                                    type="date"
                                    className="pl-9"
                                    min={new Date().toISOString().split('T')[0]}
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Slot Selection */}
                        {selectedDoctor && date && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-4">
                                <Label>Available Time Slots</Label>
                                {loadingSlots ? (
                                    <div className="text-sm text-neutral-500 py-2">Checking availability...</div>
                                ) : slots.length === 0 ? (
                                    <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
                                        No slots available on this date. Please try another day.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                        {slots.map(slot => (
                                            <Button
                                                key={slot}
                                                type="button"
                                                variant={selectedSlot === slot ? "default" : "outline"}
                                                size="sm"
                                                className={selectedSlot === slot ? "bg-blue-600 hover:bg-blue-700" : ""}
                                                onClick={() => setSelectedSlot(slot)}
                                            >
                                                {slot}
                                            </Button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Reason */}
                        <div className="space-y-2">
                            <Label>Reason for Visit (Optional)</Label>
                            <Input
                                placeholder="e.g., Fever, Checkup, Headache..."
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                            />
                        </div>

                        <div className="pt-4">
                            <Button
                                className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6"
                                disabled={!selectedDoctor || !date || !selectedSlot || isLoading}
                                onClick={handleBook}
                            >
                                {isLoading ? 'Booking...' : 'Confirm Appointment'}
                            </Button>
                        </div>

                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
