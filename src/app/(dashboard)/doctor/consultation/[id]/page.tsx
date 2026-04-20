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
import { Save, CheckCircle, Plus, Trash2, History, Activity, Pill, FlaskConical, FileText, Sunrise, Sun, Sunset, Moon } from 'lucide-react';
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
    const [history, setHistory] = useState<{ appointments: any[], labs: any[], prescriptions: any[] }>({
        appointments: [],
        labs: [],
        prescriptions: []
    });

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
    const [selectedMedForm, setSelectedMedForm] = useState<'Pill' | 'Syrup' | 'Cream' | 'Other'>('Pill');
    const [selectedDose, setSelectedDose] = useState<string>('1');
    const [selectedTimes, setSelectedTimes] = useState<[string, string, string, string]>(['0', '0', '0', '0']);
    const [selectedDuration, setSelectedDuration] = useState<string>('3 days');

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

        let daily = 0;
        selectedTimes.forEach(t => {
            if (t !== '0') {
                if (t === '¼') daily += 0.25;
                else if (t === '½') daily += 0.5;
                else if (t === '1') daily += 1;
                else if (t === '2') daily += 2;
                else daily += 1;
            }
        });
        if (daily === 0 && selectedMedForm === 'Pill') daily = 1; // Fallback if pill but no times selected

        let days = parseInt(selectedDuration) || 1;
        if (selectedDuration.includes('week')) days = parseInt(selectedDuration) * 7;
        if (selectedDuration.includes('month')) days = parseInt(selectedDuration) * 30;
        
        let qty = 1;
        if (selectedMedForm === 'Pill') {
            // daily already incorporates the specific fractional dose for each time slot
            qty = Math.ceil(daily * days);
            if (qty === 0) qty = 1;
        }

        const frequencyStr = selectedTimes.join('-'); // e.g. "½-0-0-1"

        const newItem: PrescriptionItem = {
            medicineId: med.id,
            medicineName: med.name,
            dosage: selectedDose || '1',
            frequency: frequencyStr,
            duration: selectedDuration,
            quantity: qty
        };

        setCurrentPrescription([...currentPrescription, newItem]);
        setSelectedMed('');
        setSelectedTimes(['0', '0', '0', '0']);
        setSelectedDose('1');
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
                        {history.appointments.length === 0 ? (
                            <div className="text-sm text-neutral-500 italic">No previous visits.</div>
                        ) : (
                            history.appointments.slice(0, 5).map((h, i) => (
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
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setSelectedMed(val);
                                                    if (!val) return;
                                                    const med = medicines.find(m => m.id.toString() === val);
                                                    if (med) {
                                                        const name = med.name.toLowerCase();
                                                        const unit = (med.unit || '').toLowerCase();
                                                        if (unit.includes('ml') || name.includes('syr') || name.includes('liquid')) {
                                                            setSelectedMedForm('Syrup');
                                                            setSelectedDose('5ml');
                                                        } else if (unit.includes('tube') || unit.includes('g') || name.includes('cream') || name.includes('oint')) {
                                                            setSelectedMedForm('Cream');
                                                            setSelectedDose('Apply');
                                                        } else {
                                                            setSelectedMedForm('Pill');
                                                            setSelectedDose('1');
                                                        }
                                                    }
                                                }}
                                            >
                                                <option value="">Select Medicine...</option>
                                                {medicines.map(m => (
                                                    <option key={m.id} value={m.id}>{m.name} (Stock: {m.stock})</option>
                                                ))}
                                            </select>
                                        </div>

                                        {selectedMed && (
                                            <div className="space-y-3 border-t pt-2 mt-2">
                                                {/* Frequency Quick Select */}
                                                <div>
                                                    <Label className="text-xs text-neutral-500">Frequency Pre-sets <span className="text-[10px] text-neutral-400 font-normal italic">(Applies selected dose)</span></Label>
                                                    <div className="flex gap-2 mt-1">
                                                        <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => setSelectedTimes([selectedDose, '0', '0', '0'])}>OD</Button>
                                                        <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => setSelectedTimes([selectedDose, '0', '0', selectedDose])}>BD</Button>
                                                        <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => setSelectedTimes([selectedDose, selectedDose, '0', selectedDose])}>TDS</Button>
                                                        <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => setSelectedTimes([selectedDose, selectedDose, selectedDose, selectedDose])}>QDS</Button>
                                                    </div>
                                                </div>

                                                {/* Visual Time Grid */}
                                                <div className="grid grid-cols-4 gap-2">
                                                    <Button 
                                                        variant={selectedTimes[0] !== '0' ? 'default' : 'outline'} 
                                                        size="sm" className={`h-12 text-xs flex flex-col items-center gap-1 justify-center ${selectedTimes[0] !== '0' && 'bg-amber-500 hover:bg-amber-600'}`}
                                                        onClick={() => setSelectedTimes([selectedTimes[0] === selectedDose ? '0' : selectedDose, selectedTimes[1], selectedTimes[2], selectedTimes[3]])}
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            <Sunrise className="h-4 w-4" />
                                                            {selectedTimes[0] !== '0' && <span>{selectedTimes[0]}</span>}
                                                        </div>
                                                    </Button>
                                                    <Button 
                                                        variant={selectedTimes[1] !== '0' ? 'default' : 'outline'} 
                                                        size="sm" className={`h-12 text-xs flex flex-col items-center gap-1 justify-center ${selectedTimes[1] !== '0' && 'bg-yellow-500 hover:bg-yellow-600'}`}
                                                        onClick={() => setSelectedTimes([selectedTimes[0], selectedTimes[1] === selectedDose ? '0' : selectedDose, selectedTimes[2], selectedTimes[3]])}
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            <Sun className="h-4 w-4" />
                                                            {selectedTimes[1] !== '0' && <span>{selectedTimes[1]}</span>}
                                                        </div>
                                                    </Button>
                                                    <Button 
                                                        variant={selectedTimes[2] !== '0' ? 'default' : 'outline'} 
                                                        size="sm" className={`h-12 text-xs flex flex-col items-center gap-1 justify-center ${selectedTimes[2] !== '0' && 'bg-orange-600 hover:bg-orange-700'}`}
                                                        onClick={() => setSelectedTimes([selectedTimes[0], selectedTimes[1], selectedTimes[2] === selectedDose ? '0' : selectedDose, selectedTimes[3]])}
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            <Sunset className="h-4 w-4" />
                                                            {selectedTimes[2] !== '0' && <span>{selectedTimes[2]}</span>}
                                                        </div>
                                                    </Button>
                                                    <Button 
                                                        variant={selectedTimes[3] !== '0' ? 'default' : 'outline'} 
                                                        size="sm" className={`h-12 text-xs flex flex-col items-center gap-1 justify-center ${selectedTimes[3] !== '0' && 'bg-blue-900 hover:bg-blue-950'}`}
                                                        onClick={() => setSelectedTimes([selectedTimes[0], selectedTimes[1], selectedTimes[2], selectedTimes[3] === selectedDose ? '0' : selectedDose])}
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            <Moon className="h-4 w-4" />
                                                            {selectedTimes[3] !== '0' && <span>{selectedTimes[3]}</span>}
                                                        </div>
                                                    </Button>
                                                </div>

                                                {/* Dynamic Dose & Duration */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <Label className="text-xs">Dose</Label>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {selectedMedForm === 'Pill' && ['¼', '½', '1', '2'].map(d => (
                                                                <Badge key={d} variant={selectedDose === d ? 'default' : 'outline'} className="cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={() => setSelectedDose(d)}>{d}</Badge>
                                                            ))}
                                                            {selectedMedForm === 'Syrup' && ['2.5ml', '5ml', '10ml'].map(d => (
                                                                <Badge key={d} variant={selectedDose === d ? 'default' : 'outline'} className="cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={() => setSelectedDose(d)}>{d}</Badge>
                                                            ))}
                                                            {selectedMedForm === 'Cream' && ['Apply', 'Thin Layer'].map(d => (
                                                                <Badge key={d} variant={selectedDose === d ? 'default' : 'outline'} className="cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={() => setSelectedDose(d)}>{d}</Badge>
                                                            ))}
                                                            <Badge variant="outline" className="cursor-pointer hover:bg-blue-50 text-blue-600 border-blue-200" onClick={() => setSelectedDose(prompt('Enter custom dose:', selectedDose) || selectedDose)}>Custom</Badge>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs">Duration</Label>
                                                        <select
                                                            className="w-full h-8 mt-1 rounded-md border border-input bg-background px-3 text-xs"
                                                            value={selectedDuration}
                                                            onChange={e => setSelectedDuration(e.target.value)}
                                                        >
                                                            <option value="1 day">1 Day</option>
                                                            <option value="3 days">3 Days</option>
                                                            <option value="5 days">5 Days</option>
                                                            <option value="1 week">1 Week</option>
                                                            <option value="2 weeks">2 Weeks</option>
                                                            <option value="1 month">1 Month</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="mt-3 pt-3 border-t flex justify-between items-center text-sm">
                                                    <span className="text-neutral-500 font-medium tracking-wide">Resulting Frequency:</span>
                                                    <Badge variant="outline" className="font-mono bg-neutral-50 text-neutral-800 text-sm">
                                                        {selectedTimes.join('-')}
                                                    </Badge>
                                                </div>
                                            </div>
                                        )}
                                        <Button size="sm" className="w-full mt-2" onClick={handleAddMedicine} disabled={!selectedMed}>
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

                    <TabsContent value="history" className="flex-1 overflow-y-auto space-y-4">
                        <Tabs defaultValue="appointments" className="w-full">
                            <TabsList className="grid w-full grid-cols-3 mb-4">
                                <TabsTrigger value="appointments">Appointments</TabsTrigger>
                                <TabsTrigger value="labs">Lab Tests</TabsTrigger>
                                <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
                            </TabsList>

                            <TabsContent value="appointments" className="space-y-4">
                                {history.appointments.length === 0 ? (
                                    <div className="p-8 text-center text-neutral-500 bg-white border rounded">No past appointments found.</div>
                                ) : (
                                    history.appointments.map((appt: any) => {
                                        // Find labs/prescriptions specifically for this appointment
                                        const apptLabs = history.labs.filter((l: any) => l.appointment_id === appt.id);
                                        const apptPrescriptions = history.prescriptions.filter((p: any) => p.appointment_id === appt.id);

                                        return (
                                            <Card key={appt.id} className="mb-4 shadow-sm border-l-4 border-l-blue-500">
                                                <CardHeader className="py-3 bg-neutral-50">
                                                    <div className="flex justify-between items-center">
                                                        <CardTitle className="text-base flex items-center gap-2">
                                                            <History className="h-4 w-4" /> {new Date(appt.date).toLocaleDateString()}
                                                        </CardTitle>
                                                        {appt.reason && <Badge variant="outline">{appt.reason}</Badge>}
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="pt-4 space-y-4">
                                                    {/* Diagnosis / Notes */}
                                                    <div>
                                                        <Label className="text-xs text-neutral-500 uppercase font-semibold">Clinical Notes / Diagnosis</Label>
                                                        <p className="text-sm mt-1 bg-white p-2 border rounded whitespace-pre-wrap">{appt.diagnosis || "No notes recorded."}</p>
                                                    </div>

                                                    {/* Nested Labs */}
                                                    {apptLabs.length > 0 && (
                                                        <div>
                                                            <Label className="text-xs text-neutral-500 uppercase font-semibold flex items-center gap-1">
                                                                <FlaskConical className="h-3 w-3" /> Requested Labs
                                                            </Label>
                                                            <div className="mt-1 flex flex-wrap gap-2">
                                                                {apptLabs.map((lab: any) => (
                                                                    <div key={lab.id} className="inline-flex items-center gap-1">
                                                                        <Badge variant="secondary" className="flex items-center gap-1">
                                                                            {lab.testName} <span className="opacity-50 text-[10px]">({lab.status})</span>
                                                                        </Badge>
                                                                        {lab.result_url && (
                                                                            <a href={lab.result_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 p-1 bg-blue-50 rounded" title="View Result">
                                                                                <FileText className="h-4 w-4" />
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Nested Prescriptions */}
                                                    {apptPrescriptions.length > 0 && (
                                                        <div>
                                                            <Label className="text-xs text-neutral-500 uppercase font-semibold flex items-center gap-1">
                                                                <Pill className="h-3 w-3" /> Prescriptions
                                                            </Label>
                                                            <div className="mt-1 space-y-1">
                                                                {apptPrescriptions.map((med: any, idx: number) => (
                                                                    <div key={idx} className="text-sm border rounded px-3 py-1 bg-white flex justify-between">
                                                                        <span><span className="font-medium">{med.medicineName}</span> <span className="text-neutral-500">({med.dosage})</span></span>
                                                                        <span className="text-neutral-500 text-xs">{med.frequency} • {med.duration} • x{med.quantity}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        );
                                    })
                                )}
                            </TabsContent>

                            <TabsContent value="labs" className="space-y-4">
                                {history.labs.length === 0 ? (
                                    <div className="p-8 text-center text-neutral-500 bg-white border rounded">No past lab tests found.</div>
                                ) : (
                                    <Card>
                                        <div className="divide-y">
                                            {history.labs.map((lab: any) => (
                                                <div key={lab.id} className="p-4 flex justify-between items-center hover:bg-neutral-50 transition-colors">
                                                    <div>
                                                        <div className="font-semibold text-purple-900">{lab.testName}</div>
                                                        <div className="text-xs text-neutral-500">Requested: {new Date(lab.requested_at).toLocaleDateString()}</div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <Badge variant={lab.status === 'COMPLETED' ? 'default' : 'secondary'}>
                                                            {lab.status}
                                                        </Badge>
                                                        {lab.result_url && (
                                                            <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                                                                <a href={lab.result_url} target="_blank" rel="noopener noreferrer">
                                                                    <FileText className="h-3 w-3 mr-1" /> View File
                                                                </a>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                )}
                            </TabsContent>

                            <TabsContent value="prescriptions" className="space-y-4">
                                {history.prescriptions.length === 0 ? (
                                    <div className="p-8 text-center text-neutral-500 bg-white border rounded">No past prescriptions found.</div>
                                ) : (
                                    <Card>
                                        <div className="divide-y border-t mt-2">
                                            {history.prescriptions.map((med: any, i: number) => (
                                                <div key={i} className="p-4 flex justify-between items-center hover:bg-neutral-50 transition-colors">
                                                    <div>
                                                        <div className="font-semibold text-blue-900 flex items-center gap-2">
                                                            <Pill className="h-4 w-4" /> {med.medicineName}
                                                        </div>
                                                        <div className="text-xs text-neutral-500 mt-1">
                                                            Issued: {new Date(med.issued_at).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm font-medium">{med.dosage} • {med.frequency}</div>
                                                        <div className="text-xs text-neutral-500">{med.duration} • x{med.quantity}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                )}
                            </TabsContent>
                        </Tabs>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
