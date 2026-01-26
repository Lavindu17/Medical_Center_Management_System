'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Using our custom Tabs
import { Trash2, Save, Clock, Ban, User, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { CalendarGrid } from '@/components/doctor/CalendarGrid';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

export default function DoctorProfilePage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Data State
    const [profile, setProfile] = useState({
        name: '',
        phone: '',
        specialization: '',
        consultation_fee: '',
        license_number: ''
    });

    // Schedule State (Advanced Multi-Slot)
    // Structure: { id: number/string, days: string[], start_time: string, end_time: string }[]
    const [schedules, setSchedules] = useState<any[]>([]);

    const [slotDuration, setSlotDuration] = useState('15');

    // Leaves State
    const [blockedDates, setBlockedDates] = useState<any[]>([]);

    // Calendar State
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [blockReason, setBlockReason] = useState('');

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    useEffect(() => {
        fetch('/api/doctor/profile')
            .then(res => res.json())
            .then(data => {
                if (data.user) {
                    setProfile({
                        name: data.user.name || '',
                        phone: data.user.phone || '',
                        specialization: data.doctor.specialization || '',
                        consultation_fee: data.doctor.consultation_fee || '',
                        license_number: data.doctor.license_number || ''
                    });
                    setSlotDuration(data.doctor.slot_duration?.toString() || '15');

                    // Group Raw Schedules into Blocks
                    if (data.schedules && Array.isArray(data.schedules)) {
                        const grouped: any[] = [];
                        data.schedules.forEach((row: any) => {
                            // Check if matching block exists (same start/end)
                            const existing = grouped.find(g => g.start_time.slice(0, 5) === row.start_time.slice(0, 5) && g.end_time.slice(0, 5) === row.end_time.slice(0, 5));
                            if (existing) {
                                if (!existing.days.includes(row.day)) existing.days.push(row.day);
                            } else {
                                grouped.push({
                                    id: Math.random(), // Temp UI ID
                                    start_time: row.start_time.slice(0, 5),
                                    end_time: row.end_time.slice(0, 5),
                                    days: [row.day]
                                });
                            }
                        });
                        setSchedules(grouped);
                    }

                    setBlockedDates(data.leaves || []);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/doctor/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'profile',
                    ...profile,
                    slot_duration: slotDuration,
                    schedules: schedules
                })
            });
            if (res.ok) alert('Profile updated successfully');
            else throw new Error('Failed to update');
        } catch (err) {
            alert('Error updating profile');
        } finally {
            setSaving(false);
        }
    };

    // --- LEAVE MANAGEMENT ---

    const handleDateClick = async (date: Date, isBlocked: boolean, isWorking: boolean) => {
        if (isBlocked) {
            // Unblock Logic
            const dateStr = format(date, 'yyyy-MM-dd');
            const leave = blockedDates.find(b => b.date && b.date.slice(0, 10) === dateStr);
            if (leave && confirm(`Unblock ${dateStr}?`)) {
                try {
                    const res = await fetch(`/api/doctor/profile/leaves?id=${leave.id}`, { method: 'DELETE' });
                    if (res.ok) {
                        setBlockedDates(blockedDates.filter(b => b.id !== leave.id));
                    }
                } catch (err) { console.error(err); }
            }
        } else {
            // Block Logic (Open Dialog)
            setSelectedDate(date);
            setBlockReason('');
            setIsBlockDialogOpen(true);
        }
    };

    const confirmBlockDate = async () => {
        if (!selectedDate) return;
        const dateStr = format(selectedDate, 'yyyy-MM-dd');

        try {
            const res = await fetch('/api/doctor/profile/leaves', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: dateStr, reason: blockReason })
            });

            if (res.ok) {
                const newLeave = await res.json();
                setBlockedDates([...blockedDates, newLeave]);
                setIsBlockDialogOpen(false);
            }
        } catch (err) {
            console.error(err);
        }
    };

    // --- SCHEDULE HELPERS ---

    const addScheduleBlock = () => {
        setSchedules([...schedules, { id: Math.random(), days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], start_time: '09:00', end_time: '17:00' }]);
    };

    const removeScheduleBlock = (idx: number) => {
        const newSched = [...schedules];
        newSched.splice(idx, 1);
        setSchedules(newSched);
    };

    const toggleScheduleDay = (idx: number, day: string) => {
        const newSched = [...schedules];
        const block = newSched[idx];
        if (block.days.includes(day)) {
            block.days = block.days.filter((d: string) => d !== day);
        } else {
            block.days.push(day);
        }
        setSchedules(newSched);
    };

    const updateScheduleTime = (idx: number, field: 'start_time' | 'end_time', value: string) => {
        const newSched = [...schedules];
        newSched[idx][field] = value;
        setSchedules(newSched);
    };

    if (loading) return <div className="p-8">Loading Profile...</div>;

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-neutral-900">Profile & Settings</h1>
                <p className="text-neutral-500">Manage your personal details and availability.</p>
            </div>

            <Tabs defaultValue="general" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="general">General Info</TabsTrigger>
                    <TabsTrigger value="schedule">Schedule & Availability</TabsTrigger>
                    <TabsTrigger value="leaves">Blocked Dates (Calendar)</TabsTrigger>
                </TabsList>

                <TabsContent value="general">
                    <Card>
                        <CardHeader>
                            <CardTitle>Professional Details</CardTitle>
                            <CardDescription>Update your contact and professional information.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Full Name</Label>
                                    <Input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Contact Phone</Label>
                                    <Input value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Specialization</Label>
                                    <Input value={profile.specialization} disabled className="bg-neutral-50" />
                                    <p className="text-xs text-neutral-500">Contact admin to change specialization.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Consultation Fee ($)</Label>
                                    <Input type="number" value={profile.consultation_fee} onChange={e => setProfile({ ...profile, consultation_fee: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>License Number</Label>
                                    <Input value={profile.license_number} onChange={e => setProfile({ ...profile, license_number: e.target.value })} />
                                </div>
                            </div>
                            <div className="pt-4">
                                <Button onClick={handleSaveProfile} disabled={saving} className="bg-blue-600">
                                    <Save className="mr-2 h-4 w-4" /> Save Changes
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="schedule">
                    <Card>
                        <CardHeader>
                            <CardTitle>Schedule & Availability</CardTitle>
                            <CardDescription>Configure your working hours. Add multiple blocks for different shifts (e.g., Morning/Evening).</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">

                            <div className="space-y-2">
                                <Label>Slot Duration (Minutes)</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm max-w-xs"
                                    value={slotDuration}
                                    onChange={e => setSlotDuration(e.target.value)}
                                >
                                    <option value="15">15 Minutes</option>
                                    <option value="20">20 Minutes</option>
                                    <option value="30">30 Minutes</option>
                                    <option value="45">45 Minutes</option>
                                    <option value="60">60 Minutes</option>
                                </select>
                            </div>

                            <Separator className="my-4" />

                            <div className="space-y-4">
                                {schedules.map((block, idx) => (
                                    <div key={block.id || idx} className="p-4 border rounded-lg bg-neutral-50 space-y-3 relative group">
                                        <Button
                                            size="icon" variant="ghost"
                                            className="absolute top-2 right-2 text-neutral-400 hover:text-red-500 h-8 w-8"
                                            onClick={() => removeScheduleBlock(idx)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>

                                        <div className="grid grid-cols-2 gap-4 max-w-md">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Start Time</Label>
                                                <div className="relative">
                                                    <Clock className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                                                    <Input type="time" className="pl-8 h-9" value={block.start_time} onChange={e => updateScheduleTime(idx, 'start_time', e.target.value)} />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">End Time</Label>
                                                <div className="relative">
                                                    <Clock className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                                                    <Input type="time" className="pl-8 h-9" value={block.end_time} onChange={e => updateScheduleTime(idx, 'end_time', e.target.value)} />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Active Days</Label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {daysOfWeek.map(day => (
                                                    <div
                                                        key={day}
                                                        onClick={() => toggleScheduleDay(idx, day)}
                                                        className={`
                                                            cursor-pointer px-3 py-1.5 rounded text-xs font-medium transition-colors border select-none
                                                            ${block.days.includes(day)
                                                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                                : 'bg-white text-neutral-500 border-neutral-200 hover:border-blue-300'}
                                                        `}
                                                    >
                                                        {day.slice(0, 3)}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <Button variant="outline" onClick={addScheduleBlock} className="w-full border-dashed border-2 hover:bg-neutral-50 mt-2">
                                    <Plus className="mr-2 h-4 w-4" /> Add Another Schedule Block
                                </Button>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <Button onClick={handleSaveProfile} disabled={saving} className="bg-blue-600 min-w-[120px]">
                                    <Save className="mr-2 h-4 w-4" /> Save Schedule
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="leaves">
                    <Card>
                        <CardHeader>
                            <CardTitle>Block Dates</CardTitle>
                            <CardDescription>Click on a date to block/unblock it. Red dates are already blocked.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <CalendarGrid
                                currentMonth={currentMonth}
                                onMonthChange={setCurrentMonth}
                                schedules={schedules}
                                blockedDates={blockedDates}
                                onDateClick={handleDateClick}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Block Date: {selectedDate ? format(selectedDate, 'MMM dd, yyyy') : ''}</DialogTitle>
                        <DialogDescription>
                            Prevent appointments from being booked on this date.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Reason (Optional)</Label>
                            <Input
                                placeholder="vacation, personal leave, conference..."
                                value={blockReason}
                                onChange={e => setBlockReason(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBlockDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmBlockDate}>Block Date</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
