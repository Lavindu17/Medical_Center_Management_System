
'use client';

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
                alert('Patient Registered Successfully!');
                router.push('/receptionist/patients');
            } else {
                const data = await res.json();
                alert(data.message || 'Registration Failed');
            }
        } catch (error) {
            console.error(error);
            alert('An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <Link href="/receptionist">
                    <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold text-neutral-900">Register New Patient</h1>
                    <p className="text-neutral-500">Create a new patient account for walk-ins.</p>
                </div>
            </div>

            <div className="bg-white p-8 rounded-xl border shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="John Doe" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="john@example.com" />
                            <p className="text-xs text-neutral-500">Used for login and notifications.</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Phone Number</Label>
                            <Input required value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+1 234 567 890" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Date of Birth</Label>
                            <Input type="date" required value={formData.date_of_birth} onChange={e => setFormData({ ...formData, date_of_birth: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Gender</Label>
                            <Select value={formData.gender} onValueChange={val => setFormData({ ...formData, gender: val })}>
                                <SelectTrigger>
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
                        <Label>Address</Label>
                        <Textarea required value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="123 Main St, City, Country" />
                    </div>

                    <div className="space-y-2">
                        <Label>Initial Medical History (Optional)</Label>
                        <Textarea value={formData.medical_history} onChange={e => setFormData({ ...formData, medical_history: e.target.value })} placeholder="Known allergies, conditions, etc." />
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <Link href="/receptionist">
                            <Button variant="outline" type="button">Cancel</Button>
                        </Link>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
                            {loading ? 'Saving...' : <><Save className="mr-2 h-4 w-4" /> Create Account</>}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
