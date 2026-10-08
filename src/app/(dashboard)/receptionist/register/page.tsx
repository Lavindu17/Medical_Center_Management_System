'use client';

import { PageHeader } from '@/components/ui/page-header';


import { toast } from 'sonner';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { UserPlus, Save, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPatient() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        date_of_birth: '',
        gender: '',
        address: '',
        medical_history: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/receptionist/patients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                const created = await res.json();
                toast.success(`Patient registered. One-time password: ${created.temporaryPassword} (give it to the patient; they can change it any time)`, { duration: 60000 });
                router.push('/receptionist/patients');
            } else {
                const data = await res.json();
                toast.error(data.message || 'Registration Failed');
            }
        } catch (error) {
            console.error(error);
            toast.error('An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/receptionist">
                    <Button variant="ghost" size="icon" aria-label="Back"><ArrowLeft className="h-5 w-5" aria-hidden /></Button>
                </Link>
                <PageHeader title="Register New Patient" description="Create a new patient account for walk-ins." />
            </div>

            <div className="bg-white p-8 rounded-xl border shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="f-full-name">Full Name</Label>
                        <Input id="f-full-name" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="John Doe" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="f-email">Email</Label>
                            <Input id="f-email" type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="john@example.com" />
                            <p className="text-xs text-neutral-500">Used for login and notifications.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="f-phone-number">Phone Number</Label>
                            <Input id="f-phone-number" required value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+1 234 567 890" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="f-date-of-birth">Date of Birth</Label>
                            <Input id="f-date-of-birth" type="date" required value={formData.date_of_birth} onChange={e => setFormData({ ...formData, date_of_birth: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="f-gender">Gender</Label>
                            <Select value={formData.gender} onValueChange={val => setFormData({ ...formData, gender: val })}>
                                <SelectTrigger id="f-gender">
                                    <SelectValue placeholder="Select Gender" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="MALE">Male</SelectItem>
                                    <SelectItem value="FEMALE">Female</SelectItem>
                                    <SelectItem value="OTHER">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="f-address">Address</Label>
                        <Textarea id="f-address" required value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="123 Main St, City, Country" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="f-initial-medical-history-optional">Initial Medical History (Optional)</Label>
                        <Textarea id="f-initial-medical-history-optional" value={formData.medical_history} onChange={e => setFormData({ ...formData, medical_history: e.target.value })} placeholder="Known allergies, conditions, etc." />
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <Link href="/receptionist">
                            <Button variant="outline" type="button">Cancel</Button>
                        </Link>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-100 px-8 transition-all duration-200" disabled={loading}>
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                    Processing...
                                </span>
                            ) : (
                                <><Save className="mr-2 h-4 w-4" /> Create Account</>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
