'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Save, Plus, X, User, Phone, HeartPulse, ShieldAlert, Users } from 'lucide-react';

import { useRouter } from 'next/navigation';

interface Allergy {
    name: string;
    severity: 'MILD' | 'MODERATE' | 'SEVERE';
}

export default function PatientProfilePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userId, setUserId] = useState<number | null>(null);

    // Form State
    const [form, setForm] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        date_of_birth: '',
        gender: '',
        blood_group: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
    });

    const [allergyList, setAllergyList] = useState<Allergy[]>([]);

    // Initial State for Dirty Check
    const [initialForm, setInitialForm] = useState<any>(null);
    const [initialAllergyList, setInitialAllergyList] = useState<Allergy[]>([]);

    const [newAllergyName, setNewAllergyName] = useState('');
    const [newAllergySeverity, setNewAllergySeverity] = useState<'MILD' | 'MODERATE' | 'SEVERE'>('MILD');

    useEffect(() => {
        // 1. Get Session
        fetch('/api/auth/session')
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('Unauthorized');
            })
            .then(user => {
                setUserId(user.user.id);
                fetchProfile(user.user.id);
            })
            .catch(() => router.push('/login'));
    }, [router]);

    const fetchProfile = async (id: number) => {
        try {
            const res = await fetch(`/api/patient/profile?userId=${id}`);
            if (res.ok) {
                const data = await res.json();
                const fetchedForm = {
                    name: data.name || '',
                    email: data.email || '',
                    phone: data.phone || '',
                    address: data.address || '',
                    date_of_birth: data.date_of_birth ? data.date_of_birth.split('T')[0] : '',
                    gender: data.gender || '',
                    blood_group: data.blood_group || '',
                    emergency_contact_name: data.emergency_contact_name || '',
                    emergency_contact_phone: data.emergency_contact_phone || '',
                };
                setForm(fetchedForm);
                setInitialForm(JSON.parse(JSON.stringify(fetchedForm))); // Deep copy

                let fetchedAllergies: Allergy[] = [];
                if (Array.isArray(data.allergies)) {
                    fetchedAllergies = data.allergies.map((a: any) => {
                        if (typeof a === 'string') return { name: a, severity: 'MILD' };
                        return a;
                    });
                } else if (typeof data.allergies === 'string') {
                    fetchedAllergies = data.allergies.split(',').filter((x: string) => x).map((x: string) => ({ name: x, severity: 'MILD' }));
                }
                setAllergyList(fetchedAllergies);
                setInitialAllergyList(JSON.parse(JSON.stringify(fetchedAllergies)));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const hasChanges = useMemo(() => {
        if (!initialForm) return false;

        const formChanged = JSON.stringify(form) !== JSON.stringify(initialForm);
        const allergiesChanged = JSON.stringify(allergyList) !== JSON.stringify(initialAllergyList);

        return formChanged || allergiesChanged;
    }, [form, initialForm, allergyList, initialAllergyList]);

    const handleSave = async () => {
        if (!userId) return;
        setSaving(true);
        try {
            const payload = {
                id: userId,
                ...form,
                allergies: allergyList
            };

            const res = await fetch('/api/patient/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert('Profile updated successfully!');
                // Update initial state to current state
                setInitialForm(JSON.parse(JSON.stringify(form)));
                setInitialAllergyList(JSON.parse(JSON.stringify(allergyList)));
            } else {
                alert('Failed to update profile.');
            }
        } catch (err) {
            console.error(err);
            alert('Error saving profile');
        } finally {
            setSaving(false);
        }
    };

    const addAllergy = () => {
        if (newAllergyName && !allergyList.some(a => a.name.toLowerCase() === newAllergyName.toLowerCase())) {
            setAllergyList([...allergyList, { name: newAllergyName, severity: newAllergySeverity }]);
            setNewAllergyName('');
            setNewAllergySeverity('MILD');
        }
    };

    const removeAllergy = (idx: number) => {
        setAllergyList(allergyList.filter((_, i) => i !== idx));
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'SEVERE': return 'bg-red-100 text-red-800 border-red-200';
            case 'MODERATE': return 'bg-orange-100 text-orange-800 border-orange-200';
            default: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        }
    };

    if (loading) return <div className="p-8">Loading Profile...</div>;

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">My Profile</h1>
                <p className="text-sm md:text-base text-neutral-500">Manage your personal and medical information.</p>
            </div>

            <Tabs defaultValue="personal" className="w-full">
                <TabsList className="mb-6 w-full h-auto grid grid-cols-1 sm:grid-cols-3 gap-2 bg-transparent sm:bg-muted p-0 sm:p-1">
                    <TabsTrigger value="personal" className="data-[state=active]:bg-white data-[state=active]:shadow-sm border sm:border-none py-3">
                        <User className="h-4 w-4 mr-2" /> Personal Info
                    </TabsTrigger>
                    <TabsTrigger value="medical" className="data-[state=active]:bg-white data-[state=active]:shadow-sm border sm:border-none py-3">
                        <HeartPulse className="h-4 w-4 mr-2" /> Medical Details
                    </TabsTrigger>
                    <TabsTrigger value="emergency" className="data-[state=active]:bg-white data-[state=active]:shadow-sm border sm:border-none py-3">
                        <Phone className="h-4 w-4 mr-2" /> Emergency Contact
                    </TabsTrigger>
                    <TabsTrigger value="family" className="data-[state=active]:bg-white data-[state=active]:shadow-sm border sm:border-none py-3">
                        <Users className="h-4 w-4 mr-2" /> Family Accounts
                    </TabsTrigger>
                </TabsList>

                {/* PERSONAL INFO */}
                <TabsContent value="personal">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg md:text-xl"><User className="h-5 w-5" /> Personal Information</CardTitle>
                            <CardDescription>Your basic contact details.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Full Name</Label>
                                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-11 md:h-10" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Phone Number</Label>
                                    <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="h-11 md:h-10" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input value={form.email} disabled className="bg-neutral-50 h-11 md:h-10" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Date of Birth</Label>
                                    <Input type="date" value={form.date_of_birth} disabled className="bg-neutral-50 h-11 md:h-10" />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <Label>Address</Label>
                                    <Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="min-h-[80px]" />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-end border-t pt-4">
                            <Button onClick={handleSave} disabled={!hasChanges || saving} className="bg-emerald-600 w-full sm:w-auto h-11 md:h-10"><Save className="mr-2 h-4 w-4" /> Save Changes</Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                {/* MEDICAL DETAILS */}
                <TabsContent value="medical">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg md:text-xl"><HeartPulse className="h-5 w-5" /> Medical Information</CardTitle>
                            <CardDescription>Important health details for your doctors.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Blood Group</Label>
                                    <Select value={form.blood_group} onValueChange={(val) => setForm({ ...form, blood_group: val })}>
                                        <SelectTrigger className="h-11 md:h-10">
                                            <SelectValue placeholder="Select Blood Group" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                                                <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-amber-500" /> Allergies</Label>
                                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                                    <div className="flex-1 space-y-1">
                                        <Input
                                            className="h-11 md:h-10"
                                            placeholder="Allergy Name (e.g., Peanuts)"
                                            value={newAllergyName}
                                            onChange={e => setNewAllergyName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && addAllergy()}
                                        />
                                    </div>
                                    <div className="w-full sm:w-[140px] space-y-1">
                                        <Select value={newAllergySeverity} onValueChange={(val: any) => setNewAllergySeverity(val)}>
                                            <SelectTrigger className="h-11 md:h-10">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="MILD">Mild</SelectItem>
                                                <SelectItem value="MODERATE">Moderate</SelectItem>
                                                <SelectItem value="SEVERE">Severe</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button type="button" onClick={addAllergy} variant="secondary" className="w-full sm:w-auto h-11 md:h-10"><Plus className="h-4 w-4 mr-2 sm:mr-0" /> <span className="sm:hidden">Add Allergy</span></Button>
                                </div>

                                <div className="flex flex-wrap gap-2 min-h-[40px] p-3 border rounded-md bg-neutral-50">
                                    {allergyList.length === 0 && <span className="text-sm text-neutral-400 italic">No allergies listed.</span>}
                                    {allergyList.map((allergy, idx) => (
                                        <Badge key={idx} variant="outline" className={`flex items-center gap-2 pl-3 pr-1 py-1 h-8 ${getSeverityColor(allergy.severity)}`}>
                                            <span className="font-semibold">{allergy.name}</span>
                                            <span className="text-[10px] opacity-75 uppercase tracking-wider">{allergy.severity}</span>
                                            <button onClick={() => removeAllergy(idx)} className="hover:bg-black/10 rounded-full p-1 ml-1 min-h-[24px] min-w-[24px] flex items-center justify-center"><X className="h-3 w-3" /></button>
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                        </CardContent>
                        <CardFooter className="flex justify-end border-t pt-4">
                            <Button onClick={handleSave} disabled={!hasChanges || saving} className="bg-emerald-600 w-full sm:w-auto h-11 md:h-10"><Save className="mr-2 h-4 w-4" /> Save Changes</Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                {/* EMERGENCY CONTACT */}
                <TabsContent value="emergency">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg md:text-xl"><Phone className="h-5 w-5" /> Emergency Contact</CardTitle>
                            <CardDescription>Who should we call in an emergency?</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Contact Name</Label>
                                    <Input value={form.emergency_contact_name} onChange={e => setForm({ ...form, emergency_contact_name: e.target.value })} placeholder="e.g. Spouse, Parent" className="h-11 md:h-10" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Contact Phone</Label>
                                    <Input value={form.emergency_contact_phone} onChange={e => setForm({ ...form, emergency_contact_phone: e.target.value })} placeholder="+94..." className="h-11 md:h-10" />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-end border-t pt-4">
                            <Button onClick={handleSave} disabled={!hasChanges || saving} className="bg-emerald-600 w-full sm:w-auto h-11 md:h-10"><Save className="mr-2 h-4 w-4" /> Save Changes</Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                {/* FAMILY ACCOUNTS */}
                <TabsContent value="family">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg md:text-xl"><Users className="h-5 w-5" /> Family Account Linking</CardTitle>
                            <CardDescription>Manage and link your family members' accounts.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Hardcoded Current Linked Members */}
                            <div className="space-y-3">
                                <Label>Linked Family Members</Label>
                                <div className="border rounded-md divide-y">
                                    <div className="p-4 flex items-center justify-between bg-neutral-50/50">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold">
                                                EW
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">Example Wife</p>
                                                <p className="text-xs text-neutral-500">Rel: Spouse • ID: #PT-2024-001</p>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Linked</Badge>
                                    </div>
                                    <div className="p-4 flex items-center justify-between bg-neutral-50/50">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-semibold">
                                                EC
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">Example Child</p>
                                                <p className="text-xs text-neutral-500">Rel: Child • ID: #PT-2024-002</p>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Linked</Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t pt-6 space-y-4">
                                <Label>Link New Family Member</Label>
                                <div className="grid gap-4 p-4 bg-neutral-50 rounded-lg border border-dashed">
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs">Member ID or Email</Label>
                                            <Input placeholder="e.g. PT-2024-XXX or email@example.com" className="bg-white" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs">Relationship</Label>
                                            <Select>
                                                <SelectTrigger className="bg-white">
                                                    <SelectValue placeholder="Select Relationship" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="spouse">Spouse</SelectItem>
                                                    <SelectItem value="child">Child</SelectItem>
                                                    <SelectItem value="parent">Parent</SelectItem>
                                                    <SelectItem value="sibling">Sibling</SelectItem>
                                                    <SelectItem value="other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="flex justify-end">
                                        <Button variant="outline" className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> Send Link Request</Button>
                                    </div>
                                </div>
                                <p className="text-xs text-neutral-500">
                                    * Linking an account allows you to manage appointments and view basic medical history for dependents.
                                    Visit the medical center to approve the linking.
                                </p>
                            </div>

                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

        </div>
    );
}
