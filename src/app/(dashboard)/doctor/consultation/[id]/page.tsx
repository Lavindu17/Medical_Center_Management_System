'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Using our custom Tabs if radix not avail or standard
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Save, CheckCircle, Plus, Trash2, History, Activity, Pill, FlaskConical } from 'lucide-react';
import { formatLKR } from '@/lib/utils';

// Interfaces
interface Medicine {
    id: number;
    name: string;
    stock: number;
    unit: string;
}

interface LabTest {
    id: number;
    name: string;
    price: number;
}

interface PrescriptionItem {
    medicineId: number;
    medicineName: string;
    dosage: string;
    frequency: string;
    duration: string;
    quantity: number;
}

export default function ConsultationPage() {
    const params = useParams();
    const router = useRouter();
    const appointmentId = params.id;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Data State
    const [appointment, setAppointment] = useState<any>(null);
    const [patient, setPatient] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);

    // Catalogs
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [labTests, setLabTests] = useState<LabTest[]>([]);

    // Form State - Vitals
    const [vitals, setVitals] = useState({
        weight: '',
        blood_pressure: '',
        temperature: '',
        pulse: ''
    });

    // Form State - Notes
    const [notes, setNotes] = useState('');

    // Form State - Prescription
    const [currentPrescription, setCurrentPrescription] = useState<PrescriptionItem[]>([]);
    const [selectedMed, setSelectedMed] = useState<string>(''); // Med ID
    const [medForm, setMedForm] = useState({ dosage: '500mg', frequency: '1-0-1', duration: '3 days' });

    // Form State - Labs
    const [selectedLabs, setSelectedLabs] = useState<number[]>([]); // Lab Test IDs

    // Fetch Initial Data
    useEffect(() => {
        async function loadData() {
            try {
                // 1. Fetch Appointment Details (inc Patient)
                const res = await fetch(`/api/doctor/consultation/${appointmentId}`);
                if (!res.ok) throw new Error('Failed to load consultation');
                const data = await res.json();

                setAppointment(data.appointment);
                setPatient(data.patient);
                setHistory(data.history);

                // Pre-fill if exists
                if (data.appointment) {
                    setVitals({
                        weight: data.appointment.weight || '',
                        blood_pressure: data.appointment.blood_pressure || '',
                        temperature: data.appointment.temperature || '',
                        pulse: data.appointment.pulse || ''
                    });
                    setNotes(data.appointment.notes || '');
                }

                // 2. Fetch Medicines & Tests
                const [medRes, labRes] = await Promise.all([
                    fetch('/api/admin/medicines'),
                    fetch('/api/admin/lab-tests') // Need to ensure these endpoints exist or create them
                ]);

                if (medRes.ok) setMedicines(await medRes.json());
                if (labRes.ok) setLabTests(await labRes.json());

            } catch (err) {
                console.error(err);
                alert('Error loading consultation data');
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [appointmentId]);

    // Handlers
    const handleAddMedicine = () => {
        if (!selectedMed) return;
        const med = medicines.find(m => m.id.toString() === selectedMed);
        if (!med) return;

        // Auto Calc Quantity logic (simplified)
        // Parse duration (e.g. "3 days") -> 3
        // Parse frequency (e.g. "1-0-1") -> 2
        // For now, simple manual or naive calc
        const freqCount = medForm.frequency.split('-').length; // 1-0-1 is 3 parts, but really logic implies sum.
        // Let's assume user inputs standard string. We'll default quantity to 10 for now or let user edit? 
        // Let's just calculate simplified: 1-0-1 = 3 per day. 
        // Logic: 
        let daily = 0;
        const parts = medForm.frequency.split('-');
        parts.forEach(p => daily += parseInt(p) || 0);
        if (daily === 0) daily = 1; // Fallback

        const days = parseInt(medForm.duration) || 1;
        const qty = daily * days;

        const newItem: PrescriptionItem = {
            medicineId: med.id,
            medicineName: med.name,
            dosage: medForm.dosage,
            frequency: medForm.frequency,
            duration: medForm.duration,
            quantity: qty
        };

        setCurrentPrescription([...currentPrescription, newItem]);
        setSelectedMed(''); // Reset selection
    };

    const handleRemoveMedicine = (index: number) => {
        const list = [...currentPrescription];
        list.splice(index, 1);
        setCurrentPrescription(list);
    };

    const handleSave = async (complete: boolean = false) => {
        setSaving(true);
        try {
            const payload = {
                appointmentId,
                vitals,
                notes,
                prescription: currentPrescription,
                labRequestIds: selectedLabs,
                status: complete ? 'COMPLETED' : 'ONGOING'
            };

            const res = await fetch('/api/doctor/consultation/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Failed to save');

            if (complete) {
                router.push('/doctor?success=consultation_complete');
            } else {
                alert('Progress saved');
            }

        } catch (err) {
            console.error(err);
            alert('Failed to save data');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8">Loading Consultation...</div>;
    if (!appointment) return <div className="p-8">Appointment not found</div>;

    return (
        <div className="p-6 max-w-[1600px] mx-auto grid grid-cols-12 gap-6 h-[calc(100vh-64px)] overflow-hidden">
            {/* LEFT COLUMN: Patient & Vitals */}
            <div className="col-span-12 md:col-span-4 lg:col-span-3 space-y-4 overflow-y-auto pr-2">
                {/* Patient Card */}
                <Card>
                    <CardHeader className="bg-blue-50 pb-4">
                        <CardTitle className="text-lg text-blue-800">{patient?.name}</CardTitle>
                        <div className="text-sm text-neutral-600">
                            {patient?.age ? `${patient.age} yrs` : 'DOB: ' + new Date(patient?.dob).toLocaleDateString()} • {patient?.gender}
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <div>
                            <Label className="text-xs text-neutral-500 uppercase">Reason for Visit</Label>
                            <p className="font-medium">{appointment.reason || "None provided"}</p>
                        </div>
                        <Separator />
                        <div>
                            <Label className="text-xs text-neutral-500 uppercase">Medical History</Label>
                            <p className="text-sm mt-1">{patient?.medicalHistory || "None recorded"}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Vitals Form */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Activity className="h-4 w-4 text-red-500" /> Vitals
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label className="text-xs">Weight (kg)</Label>
                                <Input
                                    value={vitals.weight}
                                    onChange={e => setVitals({ ...vitals, weight: e.target.value })}
                                    placeholder="e.g. 70"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Temp (°C)</Label>
                                <Input
                                    value={vitals.temperature}
                                    onChange={e => setVitals({ ...vitals, temperature: e.target.value })}
                                    placeholder="e.g. 36.6"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label className="text-xs">BP (mmHg)</Label>
                                <Input
                                    value={vitals.blood_pressure}
                                    onChange={e => setVitals({ ...vitals, blood_pressure: e.target.value })}
                                    placeholder="e.g. 120/80"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Pulse (bpm)</Label>
                                <Input
                                    value={vitals.pulse}
                                    onChange={e => setVitals({ ...vitals, pulse: e.target.value })}
                                    placeholder="e.g. 72"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* History Quick View */}
                <Card className="flex-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <History className="h-4 w-4 text-neutral-500" /> Past Visits
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {history.length === 0 ? (
                            <div className="text-sm text-neutral-500 italic">No previous visits.</div>
                        ) : (
                            history.map((h, i) => (
                                <div key={i} className="text-sm border-l-2 border-neutral-300 pl-3 py-1">
                                    <div className="font-semibold">{new Date(h.date).toLocaleDateString()}</div>
                                    <div className="text-neutral-600 truncate">{h.diagnosis || "No notes"}</div>
                                </div>
                            ))
                        )}
                        {/* Full history button could go here */}
                    </CardContent>
                </Card>
            </div>

            {/* RIGHT COLUMN: Workbench */}
            <div className="col-span-12 md:col-span-8 lg:col-span-9 flex flex-col h-full overflow-hidden">
                <Tabs defaultValue="consultation" className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex justify-between items-center mb-4">
                        <TabsList>
                            <TabsTrigger value="consultation">Current Consultation</TabsTrigger>
                            <TabsTrigger value="history">Full History</TabsTrigger>
                        </TabsList>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
                                <Save className="mr-2 h-4 w-4" /> Save Draft
                            </Button>
                            <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleSave(true)} disabled={saving}>
                                <CheckCircle className="mr-2 h-4 w-4" /> Complete
                            </Button>
                        </div>
                    </div>

                    <TabsContent value="consultation" className="flex-1 overflow-y-auto space-y-6 pb-20">
                        {/* Doctor Notes */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Clinical Notes (Private)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Textarea
                                    className="min-h-[150px] font-mono text-sm"
                                    placeholder="Type your diagnosis and observations here..."
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                />
                            </CardContent>
                        </Card>

                        <div className="grid lg:grid-cols-2 gap-6">
                            {/* Prescription */}
                            <Card className="border-blue-100">
                                <CardHeader className="bg-blue-50/50 pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base text-blue-900">
                                        <Pill className="h-4 w-4" /> Prescription
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4 space-y-4">
                                    {/* Add Med Form */}
                                    <div className="p-3 bg-white border rounded-lg space-y-3 shadow-sm">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Medicine</Label>
                                            <select
                                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                                                value={selectedMed}
                                                onChange={e => setSelectedMed(e.target.value)}
                                            >
                                                <option value="">Select Medicine...</option>
                                                {medicines.map(m => (
                                                    <option key={m.id} value={m.id}>{m.name} (Stock: {m.stock})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <Label className="text-xs">Dosage</Label>
                                                <Input className="h-8 text-xs" value={medForm.dosage} onChange={e => setMedForm({ ...medForm, dosage: e.target.value })} />
                                            </div>
                                            <div>
                                                <Label className="text-xs">Freq</Label>
                                                <Input className="h-8 text-xs" value={medForm.frequency} onChange={e => setMedForm({ ...medForm, frequency: e.target.value })} placeholder="1-0-1" />
                                            </div>
                                            <div>
                                                <Label className="text-xs">Duration</Label>
                                                <Input className="h-8 text-xs" value={medForm.duration} onChange={e => setMedForm({ ...medForm, duration: e.target.value })} />
                                            </div>
                                        </div>
                                        <Button size="sm" className="w-full" onClick={handleAddMedicine} disabled={!selectedMed}>
                                            <Plus className="mr-2 h-4 w-4" /> Add to List
                                        </Button>
                                    </div>

                                    {/* List */}
                                    <div className="space-y-2">
                                        {currentPrescription.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-2 bg-neutral-50 rounded border text-sm">
                                                <div>
                                                    <div className="font-semibold">{item.medicineName}</div>
                                                    <div className="text-xs text-neutral-500">{item.dosage} • {item.frequency} • {item.duration}</div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono font-bold">x{item.quantity}</span>
                                                    <button onClick={() => handleRemoveMedicine(idx)} className="text-red-500 hover:text-red-700">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {currentPrescription.length === 0 && (
                                            <div className="text-center text-xs text-neutral-400 py-4">No medicines added</div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Lab Requests */}
                            <Card className="border-purple-100">
                                <CardHeader className="bg-purple-50/50 pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base text-purple-900">
                                        <FlaskConical className="h-4 w-4" /> Lab Requests
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4 space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Select Tests</Label>
                                        <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto border p-2 rounded bg-white">
                                            {labTests.map(test => (
                                                <label key={test.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-neutral-50 p-1 rounded">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedLabs.includes(test.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedLabs([...selectedLabs, test.id]);
                                                            else setSelectedLabs(selectedLabs.filter(id => id !== test.id));
                                                        }}
                                                        className="rounded border-gray-300"
                                                    />
                                                    <span>{test.name}</span>
                                                    <span className="text-xs text-neutral-400 ml-auto">{formatLKR(test.price)}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    {selectedLabs.length > 0 && (
                                        <div className="pt-2">
                                            <Label className="text-xs">Selected ({selectedLabs.length})</Label>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {selectedLabs.map(id => {
                                                    const t = labTests.find(l => l.id === id);
                                                    return t ? <Badge key={id} variant="secondary" className="text-xs">{t.name}</Badge> : null
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="history">
                        <div className="p-8 text-center text-neutral-500">
                            Full Patient History View (Coming Soon: Detailed list of all past prescriptions/labs)
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
