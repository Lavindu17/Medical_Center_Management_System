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

    const [blockedDates, setBlockedDates] = useState<any[]>([]);
    const [newBlockDate, setNewBlockDate] = useState('');
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

    const handleBlockDate = async () => {
        if (!newBlockDate) return;
        try {
            const res = await fetch('/api/doctor/profile/leaves', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: newBlockDate, reason: blockReason })
            });

            if (res.ok) {
                const newLeave = await res.json();
                setBlockedDates([...blockedDates, newLeave]);
                setNewBlockDate('');
                setBlockReason('');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleRemoveBlock = async (id: number) => {
        try {
            const res = await fetch(`/api/doctor/profile/leaves?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setBlockedDates(blockedDates.filter(b => b.id !== id));
            }
        } catch (err) {
            console.error(err);
        }
    };

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
                    <TabsTrigger value="leaves">Blocked Dates</TabsTrigger>
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
                            <CardTitle>Blocked Dates</CardTitle>
                            <CardDescription>Set unavailable dates for holidays or leave.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex gap-4 items-end bg-neutral-50 p-4 rounded-lg border">
                                <div className="space-y-2 flex-1">
                                    <Label>Select Date</Label>
                                    <Input type="date" value={newBlockDate} onChange={e => setNewBlockDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
                                </div>
                                <div className="space-y-2 flex-[2]">
                                    <Label>Reason (Optional)</Label>
                                    <Input placeholder="e.g. Vacation" value={blockReason} onChange={e => setBlockReason(e.target.value)} />
                                </div>
                                <Button onClick={handleBlockDate} disabled={!newBlockDate} className="bg-red-600 hover:bg-red-700">
                                    <Ban className="mr-2 h-4 w-4" /> Block Date
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <Label>Upcoming Blocked Dates</Label>
                                {blockedDates.length === 0 ? (
                                    <p className="text-sm text-neutral-400 italic">No future dates blocked.</p>
                                ) : (
                                    <div className="grid gap-2">
                                        {blockedDates.map((leave) => (
                                            <div key={leave.id} className="flex items-center justify-between p-3 bg-white border rounded-md shadow-sm">
                                                <div className="flex items-center gap-4">
                                                    <div className="font-mono font-medium text-neutral-700">{new Date(leave.date).toLocaleDateString()}</div>
                                                    <Badge variant="outline">{new Date(leave.date).toLocaleDateString(undefined, { weekday: 'long' })}</Badge>
                                                    <span className="text-sm text-neutral-500">{leave.reason || 'Unavailable'}</span>
                                                </div>
                                                <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-700 h-8 w-8" onClick={() => handleRemoveBlock(leave.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
