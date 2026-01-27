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
import { Save, CheckCircle, Plus, Trash2, History, Activity, Pill, FlaskConical, Check, ChevronsUpDown, AlertCircle } from 'lucide-react';
import { formatLKR, cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

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
    const [openCombobox, setOpenCombobox] = useState(false);
    const [medForm, setMedForm] = useState({ dosage: '500mg', frequency: '1-0-1-0', duration: '3 days' });
    const [freqValues, setFreqValues] = useState({ morning: '1', noon: '0', evening: '1', night: '0' });

    // Update frequency string when inputs change
    useEffect(() => {
        const { morning, noon, evening, night } = freqValues;
        setMedForm(prev => ({
            ...prev,
            frequency: `${morning}-${noon}-${evening}-${night}`
        }));
    }, [freqValues]);

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
        parts.forEach(p => {
            // Handle "1/2" or "0.5" or "2"
            if (p.includes('/')) {
                const [num, den] = p.split('/');
                daily += (parseFloat(num) / parseFloat(den)) || 0;
            } else {
                daily += parseFloat(p) || 0;
            }
        });
        if (daily === 0) daily = 1; // Fallback

        // Parse duration: "3 days" -> 3, "1 week" -> 7
        let days = parseInt(medForm.duration) || 1;
        if (medForm.duration.includes('week')) days = days * 7;
        if (medForm.duration.includes('month')) days = days * 30;

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
                                    <div className="p-4 bg-white border rounded-lg space-y-4 shadow-sm">

                                        {/* Medicine Search (Combobox) */}
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-neutral-600">Select Medicine</Label>
                                            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        aria-expanded={openCombobox}
                                                        className="w-full justify-between font-normal"
                                                    >
                                                        {selectedMed
                                                            ? medicines.find((m) => m.id.toString() === selectedMed)?.name
                                                            : "Search medicine..."}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[400px] p-0" align="start">
                                                    <Command>
                                                        <CommandInput placeholder="Search medicine name..." />
                                                        <CommandList>
                                                            <CommandEmpty>No medicine found.</CommandEmpty>
                                                            <CommandGroup>
                                                                {medicines.map((med) => (
                                                                    <CommandItem
                                                                        key={med.id}
                                                                        value={med.name}
                                                                        keywords={[med.name, med.id.toString()]}
                                                                        onSelect={() => {
                                                                            setSelectedMed(med.id.toString());
                                                                            setOpenCombobox(false);
                                                                            setMedForm(prev => ({ ...prev, dosage: med.unit === 'tablets' ? '500mg' : '10ml' })); // Smart default
                                                                        }}
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-4 w-4",
                                                                                selectedMed === med.id.toString() ? "opacity-100" : "opacity-0"
                                                                            )}
                                                                        />
                                                                        <div className="flex flex-col">
                                                                            <span>{med.name}</span>
                                                                            <span className="text-xs text-neutral-400">Stock: <span className={med.stock < 10 ? "text-red-500 font-bold" : ""}>{med.stock}</span> {med.unit}</span>
                                                                        </div>
                                                                        {med.stock < 10 && <AlertCircle className="ml-auto h-4 w-4 text-red-500" />}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                            {selectedMed && (
                                                <div className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded inline-block">
                                                    Stock: {medicines.find(m => m.id.toString() === selectedMed)?.stock}
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Dosage & Duration */}
                                            <div className="space-y-3">
                                                <div className="space-y-1">
                                                    <Label className="text-xs font-semibold text-neutral-600">Dosage</Label>
                                                    <Input className="h-9" value={medForm.dosage} onChange={e => setMedForm({ ...medForm, dosage: e.target.value })} placeholder="e.g. 500mg" />
                                                    <div className="flex gap-1 flex-wrap">
                                                        {['250mg', '500mg', '10ml'].map(d => (
                                                            <Badge key={d} variant="outline" className="cursor-pointer hover:bg-neutral-100 font-normal" onClick={() => setMedForm(prev => ({ ...prev, dosage: d }))}>{d}</Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs font-semibold text-neutral-600">Duration</Label>
                                                    <Input className="h-9" value={medForm.duration} onChange={e => setMedForm({ ...medForm, duration: e.target.value })} placeholder="e.g. 3 days" />
                                                    <div className="flex gap-1 flex-wrap">
                                                        {['3 days', '5 days', '1 week'].map(d => (
                                                            <Badge key={d} variant="outline" className="cursor-pointer hover:bg-neutral-100 font-normal" onClick={() => setMedForm(prev => ({ ...prev, duration: d }))}>{d}</Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Frequency Options Matrix */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <Label className="text-xs font-semibold text-neutral-600">Frequency ({medForm.frequency})</Label>
                                                    <span className="text-[10px] text-neutral-400">Qty per dose</span>
                                                </div>
                                                <div className="bg-neutral-50 p-2 rounded-lg border space-y-2">
                                                    {[
                                                        { key: 'morning', label: 'Morning' },
                                                        { key: 'noon', label: 'Noon' },
                                                        { key: 'evening', label: 'Evening' },
                                                        { key: 'night', label: 'Night' }
                                                    ].map((time) => (
                                                        <div key={time.key} className="flex items-center justify-between text-xs">
                                                            <span className="w-16 font-medium text-neutral-600">{time.label}</span>
                                                            <div className="flex gap-1">
                                                                {['0', '1/2', '1', '2'].map((opt) => {
                                                                    const isActive = freqValues[time.key as keyof typeof freqValues] === opt;
                                                                    return (
                                                                        <button
                                                                            key={opt}
                                                                            className={cn(
                                                                                "h-6 w-8 rounded flex items-center justify-center border transition-colors",
                                                                                isActive
                                                                                    ? "bg-blue-600 text-white border-blue-600 font-semibold"
                                                                                    : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100"
                                                                            )}
                                                                            onClick={() => setFreqValues(prev => ({ ...prev, [time.key]: opt }))}
                                                                        >
                                                                            {opt}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleAddMedicine} disabled={!selectedMed}>
                                            <Plus className="mr-2 h-4 w-4" /> Add to Prescription
                                        </Button>
                                    </div>

                                    {/* List */}
                                    <div className="border rounded-lg overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-neutral-50 border-b">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Medicine</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Regimen</th>
                                                    <th className="px-3 py-2 text-center text-xs font-medium text-neutral-500">Qty</th>
                                                    <th className="px-3 py-2 text-right text-xs font-medium text-neutral-500"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {currentPrescription.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-neutral-50">
                                                        <td className="px-3 py-2 font-medium">{item.medicineName}</td>
                                                        <td className="px-3 py-2 text-neutral-600 text-xs">
                                                            {item.dosage} • {item.frequency} • {item.duration}
                                                        </td>
                                                        <td className="px-3 py-2 text-center font-mono font-bold text-neutral-700">{item.quantity}</td>
                                                        <td className="px-3 py-2 text-right">
                                                            <button onClick={() => handleRemoveMedicine(idx)} className="text-neutral-400 hover:text-red-500 p-1">
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {currentPrescription.length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="px-3 py-8 text-center text-neutral-400 text-xs italic">
                                                            No medicines added yet.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
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
