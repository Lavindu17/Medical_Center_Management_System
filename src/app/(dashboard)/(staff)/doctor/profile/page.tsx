'use client';
import { useCan } from '@/components/access/AccessContext';
import { PageHeader } from '@/components/ui/page-header';
import { toast } from 'sonner';
import { friendlyDay } from '@/lib/dates';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save } from 'lucide-react';
import { DOCTOR_SPECIALIZATIONS } from '@/lib/constants';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function DoctorProfilePage() {
    const canChange = useCan('doctor.profile', 'change');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState({ name: '', phone: '', specialization: '', consultation_fee: '', license_number: '' });
    // Working hours and time off are read-only here: the administrator sets them
    const [schedules, setSchedules] = useState<any[]>([]);
    const [slotDuration, setSlotDuration] = useState(15);
    const [leaves, setLeaves] = useState<any[]>([]);

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
                    setSlotDuration(Number(data.doctor.slot_duration) || 15);
                    setSchedules(Array.isArray(data.schedules) ? data.schedules.filter((r: any) => r.is_active !== 0) : []);
                    setLeaves(data.leaves || []);
                }
            })
            .catch((e) => { console.error(e); toast.error('Could not load this page. Please refresh and try again.'); })
            .finally(() => setLoading(false));
    }, []);

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/doctor/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profile),
            });
            if (res.ok) toast.success('Profile updated successfully');
            else throw new Error('Failed to update');
        } catch (err) {
            toast.error('Error updating profile');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div role="status" className="py-16 text-center text-neutral-500">Loading Profile…</div>;

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <PageHeader title="Practice Profile" description="Your details and fee. Working hours and time off are set by the administrator. Name, phone and password are on the Account page." />

            <Tabs defaultValue="general" className="w-full">
                <TabsList className="mb-4 flex flex-wrap h-auto">
                    <TabsTrigger value="general">General Info</TabsTrigger>
                    <TabsTrigger value="schedule">Working Hours & Time Off</TabsTrigger>
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
                                    <Label htmlFor="f-full-name">Full Name</Label>
                                    <Input id="f-full-name" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="f-contact-phone">Contact Phone</Label>
                                    <Input id="f-contact-phone" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="f-specialization">Specialization</Label>
                                    <select id="f-specialization"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        value={profile.specialization}
                                        onChange={e => setProfile({ ...profile, specialization: e.target.value })}
                                    >
                                        <option value="">Select Specialization...</option>
                                        {DOCTOR_SPECIALIZATIONS.map(spec => (
                                            <option key={spec} value={spec}>{spec}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="f-consultation-fee-lkr">Consultation Fee (LKR)</Label>
                                    <Input id="f-consultation-fee-lkr" type="number" value={profile.consultation_fee} onChange={e => setProfile({ ...profile, consultation_fee: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="f-license-number">License Number</Label>
                                    <Input id="f-license-number" value={profile.license_number} onChange={e => setProfile({ ...profile, license_number: e.target.value })} />
                                </div>
                            </div>
                            <div className="pt-4">
                                <Button onClick={handleSaveProfile} disabled={saving || !canChange} className="bg-emerald-600 hover:bg-emerald-700">
                                    <Save className="mr-2 h-4 w-4" /> Save Changes
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="schedule">
                    <Card>
                        <CardHeader>
                            <CardTitle>Working hours</CardTitle>
                            <CardDescription>Patients can book {slotDuration}-minute slots inside these hours. To change them or to take time off, ask the administrator.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <ul className="divide-y rounded-lg border">
                                {DAYS.map(day => {
                                    const sessions = schedules.filter(r => r.day === day).sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
                                    return (
                                        <li key={day} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                                            <span className="w-28 font-medium">{day}</span>
                                            {sessions.length === 0
                                                ? <span className="text-neutral-500">Not working</span>
                                                : sessions.map(r => <span key={r.id} className="rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-800">{String(r.start_time).slice(0, 5)} – {String(r.end_time).slice(0, 5)}</span>)}
                                        </li>
                                    );
                                })}
                            </ul>
                            <div>
                                <h3 className="mb-2 text-sm font-semibold">Upcoming time off</h3>
                                {leaves.length === 0
                                    ? <p className="text-sm text-neutral-500">None scheduled.</p>
                                    : <ul className="space-y-1 text-sm">{leaves.map(l => <li key={l.id}>{friendlyDay(l.date)}{l.reason ? <span className="text-neutral-500"> · {l.reason}</span> : null}</li>)}</ul>}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
