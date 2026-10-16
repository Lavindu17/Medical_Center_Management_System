'use client';
import { useCan } from '@/components/access/AccessContext';
import { formatDate } from '@/lib/dates';
import { toast } from 'sonner';
import { useConfirm, usePrompt } from '@/components/ui/confirm-dialog';
import { medicineForm } from '@/lib/medicine-form';
import { allergyMatches } from '@/lib/allergy';
import { FOOD_TEXT, NONE, describeLine, frequencyLabel, hasSlots, quantityFor, type FoodTiming } from '@/lib/prescription-calc';
import { RxQuickAdd } from '@/components/doctor/RxQuickAdd';
import { draftFromPreset, type LabPanel, type LineDraft, type Medicine, type PresetLine } from '@/components/doctor/rx-types';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Using our custom Tabs if radix not avail or standard
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Save, CheckCircle, Plus, Trash2, Pencil, X, History, Activity, Pill, FlaskConical, FileText, Sunrise, Sun, Sunset, Moon, Check, ChevronsUpDown, Search, ShieldAlert, AlertTriangle, Lock, Star, BookmarkPlus, Zap } from 'lucide-react';
import { formatLKR, cn } from '@/lib/utils';

// Interfaces
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
    /** How much the pharmacist has already handed out: that part of the line can no longer be removed */
    dispensedQuantity?: number;
    instructions?: string | null;
    foodTiming?: FoodTiming | null;
    asNeeded?: boolean;
}

interface Allergy { name: string; severity: string | null }
interface CurrentLab { id: number; testId: number; name: string; status: string; resultUrl: string | null; priority?: string; note?: string | null }
interface LabDetail { priority: 'ROUTINE' | 'URGENT'; note: string }

const usable = (m: Medicine) => Number(m.usable_stock ?? m.stock ?? 0);

/** How a medicine stands in the pharmacy, in words (never colour alone). */
function stockNote(m: Medicine): { text: string; tone: 'ok' | 'low' | 'out' } {
    const n = usable(m);
    if (n <= 0) return { text: 'Out of stock', tone: 'out' };
    if (n < 10) return { text: `Low: ${n} left`, tone: 'low' };
    return { text: `${n} in stock`, tone: 'ok' };
}
const STOCK_TONE = { ok: 'text-neutral-500', low: 'text-amber-700 font-medium', out: 'text-red-700 font-medium' } as const;

export default function ConsultationPage() {
    const canWrite = useCan('consultations', 'add');
    const canComplete = useCan('consultations', 'approve');
    const askText = usePrompt();
    const confirm = useConfirm();
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
    /** Medicines the doctor confirmed despite an allergy warning (sent with the save) */
    const [acknowledged, setAcknowledged] = useState<number[]>([]);
    const [asNeeded, setAsNeeded] = useState(false);
    const [foodTiming, setFoodTiming] = useState<FoodTiming | null>(null);
    const [instructions, setInstructions] = useState('');
    const [presets, setPresets] = useState<{ available: boolean; favourites: PresetLine[]; recent: PresetLine[]; panels: LabPanel[] }>({ available: false, favourites: [], recent: [], panels: [] });
    const [features, setFeatures] = useState({ rxExtras: false, labExtras: false });
    /** Priority and note per requested test, keyed by test id */
    const [labDetails, setLabDetails] = useState<Record<number, LabDetail>>({});

    // Form State - Labs
    const [selectedLabs, setSelectedLabs] = useState<number[]>([]); // Lab Test IDs
    const [currentLabs, setCurrentLabs] = useState<CurrentLab[]>([]); // what is already saved for this visit
    const [editingIndex, setEditingIndex] = useState<number | null>(null);

    // UI State for Searchable Dropdowns
    const [medOpen, setMedOpen] = useState(false);
    const [labOpen, setLabOpen] = useState(false);
    const [reviewOpen, setReviewOpen] = useState(false);

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
                // What was already saved for this visit: reopening a draft must show it, because saving sends the whole list
                if (data.current) {
                    setFeatures(data.features ?? { rxExtras: false, labExtras: false });
                    setCurrentPrescription((data.current.prescription ?? []).map((r: any) => ({
                        medicineId: r.medicineId, medicineName: r.medicineName, dosage: r.dosage, frequency: r.frequency,
                        duration: r.duration, quantity: Number(r.quantity), dispensedQuantity: Number(r.dispensedQuantity ?? 0),
                        instructions: r.instructions ?? null, foodTiming: r.foodTiming ?? null, asNeeded: Boolean(r.asNeeded),
                    })));
                    setLabDetails(Object.fromEntries((data.current.labs ?? []).map((l: CurrentLab) => [l.testId, { priority: l.priority === 'URGENT' ? 'URGENT' : 'ROUTINE', note: l.note ?? '' }])));
                    setCurrentLabs(data.current.labs ?? []);
                    setSelectedLabs((data.current.labs ?? []).map((l: CurrentLab) => l.testId));
                }

                // 2. Fetch Medicines & Tests
                const [medRes, labRes, presetRes] = await Promise.all([
                    fetch('/api/admin/medicines'),
                    fetch('/api/admin/lab-tests'),
                    fetch('/api/doctor/presets'),
                ]);
                if (presetRes.ok) setPresets(await presetRes.json());

                if (medRes.ok) setMedicines(await medRes.json());
                if (labRes.ok) setLabTests(await labRes.json());

            } catch (err) {
                console.error(err);
                toast.error('Error loading consultation data');
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [appointmentId]);

    const allergies: Allergy[] = patient?.allergies ?? [];
    const medicine = useMemo(() => medicines.find(m => m.id.toString() === selectedMed), [medicines, selectedMed]);

    // The line being built, worked out the same way it will be saved
    const draftQuantity = medicine ? quantityFor({ form: selectedMedForm === 'Other' ? 'Pill' : selectedMedForm, times: selectedTimes, duration: selectedDuration, unit: medicine.unit }) : 0;
    const draftText = describeLine({ form: selectedMedForm === 'Other' ? 'Pill' : selectedMedForm, times: selectedTimes, duration: selectedDuration, quantity: draftQuantity, asNeeded, foodTiming, instructions });
    const alreadyListed = Boolean(medicine) && editingIndex === null && currentPrescription.some(p => p.medicineId === medicine!.id);
    const draftAllergy = medicine ? allergyMatches(medicine, allergies) : [];

    // Handlers
    /** Adds (or, when editing, replaces) a line. Asks about an allergy first. Returns whether the line went in. */
    const commitDraft = async (draft: LineDraft, replaceIndex: number | null = null): Promise<boolean> => {
        const med = draft.med;
        if (!hasSlots(draft.times)) {
            toast.error('Choose when the patient takes it: tap Morning, Noon, Evening or Night, or a preset such as BD.');
            return false;
        }

        // Allergy: ask once; the doctor's confirmation travels with the save and is recorded
        const hits = allergyMatches(med, allergies);
        if (hits.length > 0 && !acknowledged.includes(med.id)) {
            const ok = await confirm({
                title: `Allergy warning: ${hits.map(h => h.name).join(', ')}`,
                description: `${patient?.name ?? 'This patient'} is recorded as allergic to ${hits.map(h => `${h.name}${h.severity ? ` (${h.severity.toLowerCase()})` : ''}`).join(', ')}, and ${med.name} may contain it. Prescribe it anyway?`,
                confirmLabel: 'Prescribe anyway',
                cancelLabel: 'Choose another medicine',
                destructive: true,
            });
            if (!ok) return false;
            setAcknowledged(list => [...list, med.id]);
        }

        const form = medicineForm(med) === 'Syrup' ? 'Syrup' : medicineForm(med) === 'Cream' ? 'Cream' : 'Pill';
        let qty = quantityFor({ form, times: draft.times, duration: draft.duration, unit: med.unit });
        const dispensed = replaceIndex !== null ? currentPrescription[replaceIndex]?.dispensedQuantity ?? 0 : 0;
        if (qty < dispensed) {
            qty = dispensed;
            toast.message(`The quantity stays at ${dispensed}: that much was already dispensed.`);
        }

        const newItem: PrescriptionItem = {
            medicineId: med.id,
            medicineName: med.name,
            dosage: draft.dose || '1',
            frequency: draft.times.join('-'), // e.g. "½-0-0-1"
            duration: draft.duration,
            quantity: qty,
            dispensedQuantity: dispensed,
            instructions: draft.instructions.trim() || null,
            foodTiming: draft.foodTiming,
            asNeeded: draft.asNeeded,
        };
        setCurrentPrescription(list => {
            if (replaceIndex === null) return [...list, newItem];
            const next = [...list];
            next[replaceIndex] = newItem;
            return next;
        });
        return true;
    };

    const resetForm = () => {
        setEditingIndex(null);
        setSelectedMed('');
        setSelectedTimes(['0', '0', '0', '0']);
        setSelectedDose('1');
        setAsNeeded(false);
        setFoodTiming(null);
        setInstructions('');
    };

    const handleAddMedicine = async () => {
        if (!medicine) return;
        const ok = await commitDraft({ med: medicine, dose: selectedDose || '1', times: selectedTimes, duration: selectedDuration, asNeeded, foodTiming, instructions }, editingIndex);
        if (ok) resetForm();
    };

    /** The quick-add line understood the medicine but not everything: fill the form with what it did understand. */
    const prefillForm = (draft: LineDraft) => {
        setSelectedMed(String(draft.med.id));
        setSelectedMedForm(medicineForm(draft.med));
        setSelectedDose(draft.dose);
        setSelectedTimes(draft.times);
        setSelectedDuration(draft.duration);
        setAsNeeded(draft.asNeeded);
        setFoodTiming(draft.foodTiming);
        setInstructions(draft.instructions);
        setEditingIndex(null);
        document.getElementById('add-med-form')?.scrollIntoView({ behavior: 'smooth' });
    };

    // Lines from the patient's most recent past prescription (one visit, newest)
    const lastVisitLines = useMemo(() => {
        const past: any[] = history.prescriptions ?? [];
        if (past.length === 0) return [] as any[];
        const newest = past[0].appointment_id;
        return past.filter(p => p.appointment_id === newest && p.medicineId && medicines.some(m => m.id === p.medicineId));
    }, [history.prescriptions, medicines]);
    const repeatable = lastVisitLines.filter(l => !currentPrescription.some(c => c.medicineId === l.medicineId));

    const repeatLastVisit = async () => {
        let added = 0;
        for (const l of repeatable) {
            const med = medicines.find(m => m.id === l.medicineId)!;
            const draft = draftFromPreset(med, { medicineId: med.id, dosage: l.dosage, frequency: l.frequency, duration: l.duration, instructions: l.instructions, foodTiming: l.foodTiming, asNeeded: Boolean(Number(l.asNeeded)) });
            if (await commitDraft(draft)) added++;
        }
        if (added > 0) toast.success(`Added ${added} medicine${added === 1 ? '' : 's'} from the last visit. Check each line, as the patient may need something different today.`);
    };

    const saveFavourite = async (item: PrescriptionItem) => {
        try {
            const res = await fetch('/api/doctor/presets', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'favourite', medicineId: item.medicineId, dosage: item.dosage, frequency: item.frequency, duration: item.duration, instructions: item.instructions ?? null, foodTiming: item.foodTiming ?? null, asNeeded: Boolean(item.asNeeded) }),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || 'Could not save');
            toast.success(`${item.medicineName} saved as a favourite`);
            const fresh = await fetch('/api/doctor/presets');
            if (fresh.ok) setPresets(await fresh.json());
        } catch (err: any) { toast.error(err.message); }
    };

    const removeFavourite = async (medicineId: number) => {
        const res = await fetch(`/api/doctor/presets?type=favourite&medicineId=${medicineId}`, { method: 'DELETE' });
        if (res.ok) setPresets(p => ({ ...p, favourites: p.favourites.filter(f => f.medicineId !== medicineId) }));
        else toast.error('Could not remove the favourite');
    };

    const handleEditMedicine = (index: number) => {
        const item = currentPrescription[index];
        setEditingIndex(index);
        setSelectedMed(item.medicineId.toString());
        setSelectedDose(item.dosage);

        // Parse frequency back to times
        const times = item.frequency.split('-') as [string, string, string, string];
        setSelectedTimes(times);
        setSelectedDuration(item.duration);
        setAsNeeded(Boolean(item.asNeeded));
        setFoodTiming(item.foodTiming ?? null);
        setInstructions(item.instructions ?? '');

        // Set form type for UI helpers
        const med = medicines.find(m => m.id === item.medicineId);
        if (med) {
            setSelectedMedForm(medicineForm(med));
        }

        // Scroll to form
        const form = document.getElementById('add-med-form');
        if (form) form.scrollIntoView({ behavior: 'smooth' });
    };

    const handleCancelEdit = resetForm;

    const handleRemoveMedicine = (index: number) => {
        if ((currentPrescription[index]?.dispensedQuantity ?? 0) > 0) {
            toast.error('The pharmacy has already dispensed this medicine, so it cannot be removed.');
            return;
        }
        const list = [...currentPrescription];
        list.splice(index, 1);
        setCurrentPrescription(list);
    };

    const handleSave = async (complete: boolean = false) => {
        setSaving(true);
        try {
            const payload = {
                appointmentId: Number(appointmentId),
                vitals,
                notes,
                prescription: currentPrescription.map(({ dispensedQuantity: _d, ...line }) => ({ ...line, instructions: line.instructions ?? null, foodTiming: line.foodTiming ?? null, asNeeded: Boolean(line.asNeeded) })),
                labOrders: selectedLabs.map(testId => ({ testId, priority: labDetails[testId]?.priority ?? 'ROUTINE', note: labDetails[testId]?.note?.trim() || null })),
                allergyAcknowledged: acknowledged,
                status: complete ? 'COMPLETED' : 'ONGOING'
            };

            const res = await fetch('/api/doctor/consultation/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.message || 'Failed to save');
            }

            if (complete) {
                router.push('/doctor?success=consultation_complete');
            } else {
                toast.success('Progress saved');
            }

        } catch (err: any) {
            console.error(err);
            toast.error(err?.message || 'Failed to save data');
        } finally {
            setSaving(false);
            setReviewOpen(false);
        }
    };

    const labById = (id: number) => labTests.find(t => t.id === id);
    const labTotal = selectedLabs.reduce((sum, id) => sum + Number(labById(id)?.price ?? 0), 0);
    const medicineCost = currentPrescription.reduce((sum, p) => sum + p.quantity * Number((medicines.find(m => m.id === p.medicineId) as any)?.price ?? 0), 0);
    const lastDone = (testId: number) => {
        const cutoff = Date.now() - 30 * 86_400_000;
        const found = history.labs.find((l: any) => l.test_id === testId && l.status === 'COMPLETED' && new Date(l.requested_at).getTime() >= cutoff);
        return found ? formatDate(found.requested_at) : null;
    };
    const savedLab = (testId: number) => currentLabs.find(l => l.testId === testId);
    /** The newest result for this test in the last 30 days, from the patient's earlier visits */
    const lastResult = (testId: number) => {
        const cutoff = Date.now() - 30 * 86_400_000;
        const found = history.labs.find((l: any) => l.test_id === testId && l.status === 'COMPLETED' && new Date(l.requested_at).getTime() >= cutoff);
        return found ? { date: formatDate(found.requested_at), url: found.result_url as string | null } : null;
    };

    const applyPanel = (panel: LabPanel) => {
        const add = panel.testIds.filter(id => !selectedLabs.includes(id) && labTests.some(t => t.id === id));
        if (add.length === 0) { toast.message(`Every test in ${panel.name} is already requested.`); return; }
        setSelectedLabs(list => [...list, ...add]);
        toast.success(`Added ${add.length} test${add.length === 1 ? '' : 's'} from ${panel.name}`);
    };

    const savePanel = async () => {
        const name = await askText({ title: 'Save these tests as a set', label: 'Name of the set', placeholder: 'For example: Fever workup', confirmLabel: 'Save set' });
        if (!name?.trim()) return;
        try {
            const res = await fetch('/api/doctor/presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'panel', name: name.trim(), testIds: selectedLabs }) });
            if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || 'Could not save the set');
            toast.success(`Saved ${name.trim()}`);
            const fresh = await fetch('/api/doctor/presets');
            if (fresh.ok) setPresets(await fresh.json());
        } catch (err: any) { toast.error(err.message); }
    };

    const deletePanel = async (panel: LabPanel) => {
        if (!await confirm({ title: `Delete the set "${panel.name}"?`, description: 'Tests already requested are not affected.', confirmLabel: 'Delete set', cancelLabel: 'Keep it', destructive: true })) return;
        const res = await fetch(`/api/doctor/presets?type=panel&id=${panel.id}`, { method: 'DELETE' });
        if (res.ok) setPresets(p => ({ ...p, panels: p.panels.filter(x => x.id !== panel.id) }));
        else toast.error('Could not delete the set');
    };

    if (loading) return <div role="status" className="py-16 text-center text-neutral-500">Loading Consultation…</div>;
    if (!appointment) return <div role="alert" className="py-16 text-center text-neutral-600">Appointment not found</div>;

    return (
        <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
            {/* LEFT COLUMN: Patient & Vitals */}
            <div className="space-y-4 lg:col-span-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:pr-1 xl:col-span-3">
                {allergies.length > 0 && (
                    <div role="alert" className="rounded-xl border-2 border-red-300 bg-red-50 p-3 text-red-900">
                        <p className="flex items-center gap-2 text-sm font-bold"><ShieldAlert className="h-4 w-4" aria-hidden /> Allergies</p>
                        <ul className="mt-1 space-y-0.5 text-sm">
                            {allergies.map(a => <li key={a.name}>{a.name}{a.severity ? <span className="ml-1 text-xs font-semibold uppercase">({a.severity.toLowerCase()})</span> : null}</li>)}
                        </ul>
                    </div>
                )}

                {/* Patient Card */}
                <Card>
                    <CardHeader className="bg-emerald-50 pb-4">
                        <CardTitle className="text-lg text-emerald-800">{patient?.name}</CardTitle>
                        <div className="text-sm text-neutral-600">
                            {patient?.age ? `${patient.age} yrs` : 'DOB: ' + formatDate(patient?.dob)} • {patient?.gender}
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
                                <Label htmlFor="f-weight-kg" className="text-xs">Weight (kg)</Label>
                                <Input id="f-weight-kg"
                                    value={vitals.weight}
                                    onChange={e => setVitals({ ...vitals, weight: e.target.value })}
                                    placeholder="e.g. 70"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="f-temp-c" className="text-xs">Temp (°C)</Label>
                                <Input id="f-temp-c"
                                    value={vitals.temperature}
                                    onChange={e => setVitals({ ...vitals, temperature: e.target.value })}
                                    placeholder="e.g. 36.6"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label htmlFor="f-bp-mmhg" className="text-xs">BP (mmHg)</Label>
                                <Input id="f-bp-mmhg"
                                    value={vitals.blood_pressure}
                                    onChange={e => setVitals({ ...vitals, blood_pressure: e.target.value })}
                                    placeholder="e.g. 120/80"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="f-pulse-bpm" className="text-xs">Pulse (bpm)</Label>
                                <Input id="f-pulse-bpm"
                                    value={vitals.pulse}
                                    onChange={e => setVitals({ ...vitals, pulse: e.target.value })}
                                    placeholder="e.g. 72"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* History Quick View */}
                <Card className="hidden lg:block">
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
                                    <div className="font-semibold">{formatDate(h.date)}</div>
                                    <div className="text-neutral-600 truncate">{h.diagnosis || "No notes"}</div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* RIGHT COLUMN: Workbench */}
            <div className="min-w-0 lg:col-span-8 xl:col-span-9">
                <Tabs defaultValue="consultation" className="w-full">
                    <div className="sticky top-14 z-20 -mx-1 mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-background/95 px-1 py-2 backdrop-blur md:top-0">
                        <TabsList>
                            <TabsTrigger value="consultation">Current Consultation</TabsTrigger>
                            <TabsTrigger value="history">Full History</TabsTrigger>
                        </TabsList>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => handleSave(false)} disabled={saving || !canWrite} className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 transition-all">
                                <Save className="mr-2 h-4 w-4" /> Save Draft
                            </Button>
                            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-100 px-6 transition-all" onClick={() => setReviewOpen(true)} disabled={saving || !canWrite} hidden={!canComplete}>
                                <CheckCircle className="mr-2 h-4 w-4" /> Review and complete
                            </Button>
                        </div>
                    </div>

                    <TabsContent value="consultation" className="space-y-6 pb-8">
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

                        <div className="grid grid-cols-1 gap-6">
                            {/* Prescription */}
                            <Card className="border-emerald-100">
                                <CardHeader className="bg-emerald-50/50 pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base text-emerald-900">
                                        <div className="p-1.5 bg-emerald-100 rounded-lg">
                                            <Pill className="h-4 w-4 text-emerald-700" />
                                        </div>
                                        Prescription Management
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-5 space-y-5">
                                    <RxQuickAdd
                                        medicines={medicines}
                                        favourites={presets.favourites}
                                        recent={presets.recent}
                                        repeatCount={repeatable.length}
                                        onRepeat={repeatLastVisit}
                                        onCommit={(d) => { void commitDraft(d); }}
                                        onPrefill={prefillForm}
                                    />

                                    {/* Add Med Form */}
                                    <div id="add-med-form" className={`p-4 border rounded-xl space-y-4 shadow-sm transition-all duration-300 ${editingIndex !== null ? 'bg-amber-50/80 border-amber-200 ring-2 ring-amber-100' : 'bg-white border-emerald-100'}`}>
                                        {editingIndex !== null && (
                                            <div className="flex justify-between items-center pb-2 border-b border-amber-200/50 mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                                    <span className="text-sm font-bold text-amber-800 uppercase tracking-tight">Editing Item #{editingIndex + 1}</span>
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="h-7 w-7 p-0 hover:bg-amber-200/50 text-amber-700" aria-label="Close">
                                                    <X className="h-4 w-4" aria-hidden />
                                                </Button>
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            <Label className="text-xs">Medicine</Label>
                                            <Popover open={medOpen} onOpenChange={setMedOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        aria-expanded={medOpen}
                                                        className="w-full justify-between font-normal"
                                                    >
                                                        {medicine ? medicine.name : "Select medicine..."}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[400px] p-0 shadow-2xl bg-white border-emerald-200 z-50" align="start">
                                                    <Command className="bg-white">
                                                        <CommandInput placeholder="Search by name or generic name..." />
                                                        <CommandList>
                                                            <CommandEmpty>No medicine found.</CommandEmpty>
                                                            <CommandGroup>
                                                                {medicines.map((med) => {
                                                                    const note = stockNote(med);
                                                                    const risky = allergyMatches(med, allergies).length > 0;
                                                                    return (
                                                                        <CommandItem
                                                                            key={med.id}
                                                                            value={`${med.name} ${med.generic_name ?? ''} ${med.id}`}
                                                                            onSelect={() => {
                                                                                const val = med.id.toString();
                                                                                setSelectedMed(val);
                                                                                setMedOpen(false);

                                                                                // Auto-fill logic
                                                                                const form = medicineForm(med);
                                                                                setSelectedMedForm(form);
                                                                                setSelectedDose(form === 'Syrup' ? '5ml' : form === 'Cream' ? 'Apply' : '1');
                                                                                setSelectedTimes(['0', '0', '0', '0']);
                                                                            }}
                                                                        >
                                                                            <Check className={cn("mr-2 h-4 w-4", selectedMed === med.id.toString() ? "opacity-100" : "opacity-0")} />
                                                                            <div className="flex min-w-0 flex-1 flex-col">
                                                                                <span className="truncate">{med.name}{med.strength ? ` ${med.strength}` : ''}</span>
                                                                                <span className="text-[11px] text-neutral-500">
                                                                                    {med.generic_name ? `${med.generic_name} · ` : ''}<span className={STOCK_TONE[note.tone]}>{note.text}</span>
                                                                                </span>
                                                                            </div>
                                                                            {risky && <span className="ml-2 inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-800"><ShieldAlert className="h-3 w-3" aria-hidden /> Allergy</span>}
                                                                        </CommandItem>
                                                                    );
                                                                })}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                            {medicine && (
                                                <p className={`text-xs ${STOCK_TONE[stockNote(medicine).tone]}`}>
                                                    {stockNote(medicine).tone === 'out' ? 'Out of stock (expired batches are not counted). You can still prescribe it; the pharmacy will need to restock.' : `Pharmacy: ${stockNote(medicine).text}`}
                                                </p>
                                            )}
                                            {draftAllergy.length > 0 && (
                                                <p role="alert" className="flex items-start gap-1.5 rounded-md bg-red-50 px-2 py-1.5 text-xs font-medium text-red-900"><ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> Recorded allergy: {draftAllergy.map(a => a.name).join(', ')}. You will be asked to confirm.</p>
                                            )}
                                            {alreadyListed && (
                                                <p role="status" className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-900"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> This medicine is already on the prescription. Edit that line instead, unless you really want it twice.</p>
                                            )}
                                        </div>

                                        {selectedMed && (
                                            <div className="mt-2 grid gap-4 border-t pt-3 md:grid-cols-2">
                                                <div className="space-y-3">
                                                {/* Frequency Quick Select */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <Label className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Frequency Pre-sets</Label>
                                                        <span className="text-[10px] text-neutral-400 font-medium italic">Auto-applies dose</span>
                                                    </div>
                                                    <div className="flex gap-1.5">
                                                        <Button variant="outline" size="sm" className="h-8 text-xs flex-1 border-neutral-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all" onClick={() => setSelectedTimes([selectedDose, '0', '0', '0'])}>OD</Button>
                                                        <Button variant="outline" size="sm" className="h-8 text-xs flex-1 border-neutral-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all" onClick={() => setSelectedTimes([selectedDose, '0', '0', selectedDose])}>BD</Button>
                                                        <Button variant="outline" size="sm" className="h-8 text-xs flex-1 border-neutral-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all" onClick={() => setSelectedTimes([selectedDose, selectedDose, '0', selectedDose])}>TDS</Button>
                                                        <Button variant="outline" size="sm" className="h-8 text-xs flex-1 border-neutral-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all" onClick={() => setSelectedTimes([selectedDose, selectedDose, selectedDose, selectedDose])}>QDS</Button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-4 gap-2">
                                                    {([
                                                        { i: 0, label: 'Morning', Icon: Sunrise, on: 'bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-100 hover:bg-amber-200', icon: 'text-amber-600' },
                                                        { i: 1, label: 'Noon', Icon: Sun, on: 'bg-yellow-50 text-yellow-900 border-yellow-300 ring-2 ring-yellow-50 hover:bg-yellow-100', icon: 'text-yellow-600' },
                                                        { i: 2, label: 'Evening', Icon: Sunset, on: 'bg-orange-50 text-orange-900 border-orange-300 ring-2 ring-orange-50 hover:bg-orange-100', icon: 'text-orange-600' },
                                                        { i: 3, label: 'Night', Icon: Moon, on: 'bg-emerald-900 text-white border-emerald-950 ring-2 ring-emerald-100 hover:bg-emerald-950', icon: 'text-emerald-300' },
                                                    ] as const).map(({ i, label, Icon, on, icon }) => {
                                                        const active = selectedTimes[i] !== NONE;
                                                        return (
                                                            <Button
                                                                key={label}
                                                                variant={active ? 'default' : 'outline'}
                                                                size="sm"
                                                                aria-pressed={active}
                                                                className={`h-14 text-xs flex flex-col items-center gap-1.5 justify-center transition-all ${active ? on : 'bg-white hover:bg-neutral-50 text-neutral-500'}`}
                                                                onClick={() => {
                                                                    const next = [...selectedTimes] as [string, string, string, string];
                                                                    next[i] = active ? NONE : selectedDose;
                                                                    setSelectedTimes(next);
                                                                }}
                                                            >
                                                                <Icon className={`h-5 w-5 ${active ? icon : 'text-neutral-400'}`} aria-hidden />
                                                                <span className={active ? 'font-bold' : 'font-medium'}>{active ? `${label}: ${selectedTimes[i]}` : label}</span>
                                                            </Button>
                                                        );
                                                    })}
                                                </div>

                                                </div>
                                                <div className="space-y-3">
                                                {/* Dynamic Dose & Duration */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <Label className="text-xs">Dose</Label>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {selectedMedForm === 'Pill' && ['¼', '½', '1', '2'].map(d => (
                                                                <Badge key={d} variant={selectedDose === d ? 'default' : 'outline'} className="cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800" role="button" tabIndex={0} onClick={() => setSelectedDose(d)}>{d}</Badge>
                                                            ))}
                                                            {selectedMedForm === 'Syrup' && ['2.5ml', '5ml', '10ml'].map(d => (
                                                                <Badge key={d} variant={selectedDose === d ? 'default' : 'outline'} className="cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800" role="button" tabIndex={0} onClick={() => setSelectedDose(d)}>{d}</Badge>
                                                            ))}
                                                            {selectedMedForm === 'Cream' && ['Apply', 'Thin Layer'].map(d => (
                                                                <Badge key={d} variant={selectedDose === d ? 'default' : 'outline'} className="cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800" role="button" tabIndex={0} onClick={() => setSelectedDose(d)}>{d}</Badge>
                                                            ))}
                                                            <Badge variant="outline" className="cursor-pointer hover:bg-emerald-50 text-emerald-600 border-emerald-200" role="button" tabIndex={0} onClick={async () => { const dose = await askText({ title: 'Custom dose', label: 'Dose', defaultValue: selectedDose, placeholder: 'For example 1.5 or 7.5ml', confirmLabel: 'Use this dose' }); if (dose) setSelectedDose(dose.trim()); }}>Custom</Badge>
                                                        </div>
                                                        <p className="mt-1 text-[11px] text-neutral-500">Dose now: <strong>{selectedDose}</strong>. Pick it before tapping a time.</p>
                                                    </div>
                                                    <div>
                                                        <Label htmlFor="f-duration" className="text-xs">Duration</Label>
                                                        <select id="f-duration"
                                                            className="w-full h-8 mt-1 rounded-md border border-input bg-background px-3 text-xs"
                                                            value={selectedDuration}
                                                            onChange={e => setSelectedDuration(e.target.value)}
                                                        >
                                                            {!['1 day', '3 days', '5 days', '7 days', '10 days', '2 weeks', '1 month', '2 months'].includes(selectedDuration) && <option value={selectedDuration}>{selectedDuration}</option>}
                                                            <option value="1 day">1 Day</option>
                                                            <option value="3 days">3 Days</option>
                                                            <option value="5 days">5 Days</option>
                                                            <option value="7 days">7 Days</option>
                                                            <option value="10 days">10 Days</option>
                                                            <option value="2 weeks">2 Weeks</option>
                                                            <option value="1 month">1 Month</option>
                                                            <option value="2 months">2 Months</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                {features.rxExtras && (
                                                    <div className="space-y-2">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-xs font-medium text-neutral-700">With food?</span>
                                                            {(['BEFORE', 'AFTER', 'WITH'] as const).map(t => (
                                                                <button key={t} type="button" aria-pressed={foodTiming === t} onClick={() => setFoodTiming(foodTiming === t ? null : t)}
                                                                    className={`min-h-8 rounded-full border px-3 text-xs font-medium ${foodTiming === t ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-neutral-300 bg-white hover:bg-neutral-50'}`}>
                                                                    {FOOD_TEXT[t][0].toUpperCase() + FOOD_TEXT[t].slice(1)}
                                                                </button>
                                                            ))}
                                                            <label className="ml-auto inline-flex min-h-8 cursor-pointer items-center gap-1.5 text-xs font-medium text-neutral-800">
                                                                <input type="checkbox" checked={asNeeded} onChange={e => setAsNeeded(e.target.checked)} className="h-4 w-4" /> Only when needed
                                                            </label>
                                                        </div>
                                                        <div>
                                                            <Label htmlFor="rx-instructions" className="text-xs">Instructions for the patient (optional)</Label>
                                                            <Input id="rx-instructions" value={instructions} maxLength={255} onChange={e => setInstructions(e.target.value)} placeholder="For example: finish the whole course, avoid alcohol" className="mt-1 h-9 text-sm" />
                                                        </div>
                                                    </div>
                                                )}
                                                </div>
                                                <div aria-live="polite" className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50/40 p-3 text-sm md:col-span-2">
                                                    <p className="text-[11px] font-bold uppercase tracking-tight text-neutral-500">How the patient will read it</p>
                                                    <p className="mt-1 font-medium text-neutral-900">{draftText}</p>
                                                    {medicine && hasSlots(selectedTimes) && usable(medicine) < draftQuantity && (
                                                        <p className="mt-1 text-xs font-medium text-amber-800">The pharmacy has {usable(medicine)} usable, and this needs {draftQuantity}. It may only be partly dispensed.</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex gap-2 mt-2">
                                            {editingIndex !== null && (
                                                <Button variant="outline" size="sm" className="flex-1" onClick={handleCancelEdit}>
                                                    Cancel
                                                </Button>
                                            )}
                                            <Button size="sm" className={`flex-1 ${editingIndex !== null ? 'bg-amber-600 hover:bg-amber-700' : ''}`} onClick={handleAddMedicine} disabled={!selectedMed}>
                                                {editingIndex !== null ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                                                {editingIndex !== null ? 'Update Item' : 'Add to List'}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* List */}
                                    <div className="space-y-3">
                                        {currentPrescription.map((item, idx) => {
                                            const med = medicines.find(m => m.id === item.medicineId);
                                            const form = med ? medicineForm(med) : 'Pill';
                                            const locked = (item.dispensedQuantity ?? 0) > 0;
                                            return (
                                                <div key={`${item.medicineId}-${idx}`} className="group flex flex-col p-3 bg-white border border-emerald-100 rounded-xl shadow-sm hover:shadow-md hover:border-emerald-200 transition-all">
                                                    <div className="flex justify-between items-start gap-3">
                                                        <div className="flex gap-3 min-w-0">
                                                            <div className="w-10 h-10 shrink-0 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                                                                <Pill className="h-5 w-5" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="font-bold text-neutral-800 text-base leading-tight">{item.medicineName}</div>
                                                                <p className="mt-1 text-sm text-neutral-700">{describeLine({ form, times: item.frequency.split('-'), duration: item.duration, quantity: item.quantity, asNeeded: item.asNeeded, foodTiming: item.foodTiming, instructions: item.instructions })}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <div className="font-mono font-black text-xl text-emerald-900">x{item.quantity}</div>
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 pt-3 border-t border-emerald-50 flex flex-wrap justify-between items-center gap-2">
                                                        <div className="flex items-center gap-2">
                                                            {locked && <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-1 text-[11px] font-semibold text-neutral-700"><Lock className="h-3 w-3" aria-hidden /> {item.dispensedQuantity} of {item.quantity} dispensed</span>}
                                                            {med && usable(med) < item.quantity - (item.dispensedQuantity ?? 0) && !locked && <span className="text-[11px] font-medium text-amber-800">Stock: {usable(med)}</span>}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            {presets.available && (() => {
                                                                const fav = presets.favourites.some(fv => fv.medicineId === item.medicineId);
                                                                return (
                                                                    <button type="button" onClick={() => (fav ? removeFavourite(item.medicineId) : saveFavourite(item))}
                                                                        aria-pressed={fav} aria-label={fav ? `Remove ${item.medicineName} from favourites` : `Save ${item.medicineName} as a favourite`}
                                                                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg transition-all">
                                                                        <Star className={`h-3 w-3 ${fav ? 'fill-amber-400 text-amber-500' : ''}`} aria-hidden /> {fav ? 'FAVOURITE' : 'SAVE'}
                                                                    </button>
                                                                );
                                                            })()}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleEditMedicine(idx)}
                                                                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-600 hover:text-white rounded-lg transition-all"
                                                            >
                                                                <Pencil className="h-3 w-3" aria-hidden /> EDIT
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveMedicine(idx)}
                                                                disabled={locked}
                                                                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-600 hover:text-white rounded-lg transition-all disabled:cursor-not-allowed disabled:opacity-40"
                                                            >
                                                                <Trash2 className="h-3 w-3" aria-hidden /> REMOVE
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {currentPrescription.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-10 text-neutral-500 border-2 border-dashed border-neutral-200 rounded-xl bg-neutral-50/50">
                                                <Pill className="h-10 w-10 mb-2 opacity-30" />
                                                <p className="text-xs font-medium uppercase tracking-widest">No medicines prescribed yet</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Lab Requests */}
                            <Card className="border-teal-100">
                                <CardHeader className="bg-teal-50/50 pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base text-teal-900">
                                        <FlaskConical className="h-4 w-4" /> Lab Requests
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4 space-y-4">
                                    {presets.panels.length > 0 && (
                                        <div>
                                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">Your test sets</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {presets.panels.map(panel => (
                                                    <span key={panel.id} className="inline-flex items-center overflow-hidden rounded-full border border-teal-200 bg-white text-xs">
                                                        <button type="button" onClick={() => applyPanel(panel)} className="min-h-9 px-3 font-medium hover:bg-teal-50" title={`Add the ${panel.testIds.length} tests in ${panel.name}`}>
                                                            {panel.name} <span className="text-neutral-600">({panel.testIds.length})</span>
                                                        </button>
                                                        <button type="button" onClick={() => deletePanel(panel)} className="min-h-9 border-l border-teal-100 px-2 text-neutral-600 hover:bg-red-50 hover:text-red-700" aria-label={`Delete the set ${panel.name}`}><X className="h-3 w-3" aria-hidden /></button>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label className="text-xs">Add a test</Label>
                                        <Popover open={labOpen} onOpenChange={setLabOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={labOpen}
                                                    className="w-full justify-between font-normal"
                                                >
                                                    <span className="text-neutral-500">Search tests...</span>
                                                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[400px] p-0 shadow-2xl bg-white border-teal-200 z-50" align="start">
                                                <Command className="bg-white">
                                                    <CommandInput placeholder="Search tests..." />
                                                    <CommandList>
                                                        <CommandEmpty>No lab test found.</CommandEmpty>
                                                        <CommandGroup>
                                                            {labTests.map((test) => {
                                                                const picked = selectedLabs.includes(test.id);
                                                                const prior = lastResult(test.id);
                                                                return (
                                                                    <CommandItem
                                                                        key={test.id}
                                                                        value={`${test.name} ${test.id}`}
                                                                        onSelect={() => {
                                                                            if (picked) {
                                                                                if (savedLab(test.id)?.status === 'COMPLETED') return;
                                                                                setSelectedLabs(selectedLabs.filter(id => id !== test.id));
                                                                            } else {
                                                                                setSelectedLabs([...selectedLabs, test.id]);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <div className="flex items-center w-full">
                                                                            <div className={cn(
                                                                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                                                picked ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                                                                            )}>
                                                                                <Check className="h-4 w-4" />
                                                                            </div>
                                                                            <span className="flex flex-1 flex-col">
                                                                                <span>{test.name}</span>
                                                                                {prior && <span className="text-[11px] font-medium text-amber-800">Result already on file from {prior.date}</span>}
                                                                            </span>
                                                                            <span className="text-xs text-neutral-500">{formatLKR(test.price)}</span>
                                                                        </div>
                                                                    </CommandItem>
                                                                );
                                                            })}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    {selectedLabs.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-8 text-neutral-500 border-2 border-dashed border-neutral-200 rounded-xl bg-neutral-50/50">
                                            <FlaskConical className="h-8 w-8 mb-2 opacity-30" />
                                            <p className="text-xs font-medium uppercase tracking-widest">No tests requested</p>
                                        </div>
                                    ) : (
                                        <ul className="divide-y rounded-xl border border-teal-100">
                                            {selectedLabs.map(id => {
                                                const t = labById(id);
                                                const saved = savedLab(id);
                                                const finished = saved?.status === 'COMPLETED';
                                                const prior = lastResult(id);
                                                const detail = labDetails[id] ?? { priority: 'ROUTINE' as const, note: '' };
                                                const setDetail = (patch: Partial<LabDetail>) => setLabDetails(d => ({ ...d, [id]: { ...detail, ...patch } }));
                                                return (
                                                    <li key={id} className="space-y-2 px-3 py-2.5 text-sm">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <p className="truncate font-medium text-neutral-900">{t?.name ?? saved?.name ?? `Test #${id}`}</p>
                                                                <p className="text-xs text-neutral-600">
                                                                    {finished ? 'Result ready' : saved ? 'Requested, waiting for the lab' : 'Will be sent when you save'}
                                                                    {t ? ` · ${formatLKR(t.price)}` : ''}
                                                                </p>
                                                            </div>
                                                            {finished ? (
                                                                <span className="flex shrink-0 items-center gap-2 text-xs">
                                                                    {saved?.resultUrl && <a href={saved.resultUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-emerald-800 underline"><FileText className="h-3.5 w-3.5" aria-hidden /> View</a>}
                                                                    <Lock className="h-3.5 w-3.5 text-neutral-500" aria-label="Locked: the result is in" />
                                                                </span>
                                                            ) : (
                                                                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-neutral-600 hover:text-red-700" onClick={() => setSelectedLabs(selectedLabs.filter(x => x !== id))} aria-label={`Remove ${t?.name ?? 'test'}`}>
                                                                    <X className="h-4 w-4" aria-hidden />
                                                                </Button>
                                                            )}
                                                        </div>

                                                        {!finished && features.labExtras && (
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <div role="group" aria-label={`Priority for ${t?.name ?? 'test'}`} className="inline-flex overflow-hidden rounded-md border border-neutral-300 text-xs font-medium">
                                                                    {(['ROUTINE', 'URGENT'] as const).map(p => (
                                                                        <button key={p} type="button" aria-pressed={detail.priority === p} onClick={() => setDetail({ priority: p })}
                                                                            className={`min-h-8 px-3 ${detail.priority === p ? (p === 'URGENT' ? 'bg-red-600 text-white' : 'bg-teal-700 text-white') : 'bg-white hover:bg-neutral-50'}`}>
                                                                            {p === 'URGENT' ? 'Urgent' : 'Routine'}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                                <Input aria-label={`Note for the lab about ${t?.name ?? 'this test'}`} value={detail.note} maxLength={255} onChange={e => setDetail({ note: e.target.value })} placeholder="Note for the lab (fasting, suspected…)" className="h-8 min-w-[10rem] flex-1 text-xs" />
                                                            </div>
                                                        )}

                                                        {prior && !finished && (
                                                            <p className="flex flex-wrap items-center gap-x-2 text-[11px] font-medium text-amber-800">
                                                                Last result {prior.date}. Is a repeat needed?
                                                                {prior.url && <a href={prior.url} target="_blank" rel="noopener noreferrer" className="underline">View it</a>}
                                                            </p>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                    {selectedLabs.length > 0 && (
                                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                            <span><span className="text-neutral-600">{selectedLabs.length} test{selectedLabs.length === 1 ? '' : 's'}</span> <span className="ml-2 font-semibold tabular-nums">{formatLKR(labTotal)}</span></span>
                                            {presets.available && (
                                                <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5" onClick={savePanel}><BookmarkPlus className="h-3.5 w-3.5" aria-hidden /> Save as a set</Button>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="history" className="space-y-4 pb-8">
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
                                            <Card key={appt.id} className="mb-4 shadow-sm border-l-4 border-l-emerald-500">
                                                <CardHeader className="py-3 bg-neutral-50">
                                                    <div className="flex justify-between items-center">
                                                        <CardTitle className="text-base flex items-center gap-2">
                                                            <History className="h-4 w-4" /> {formatDate(appt.date)}
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
                                                                            <a href={lab.result_url} target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:text-emerald-700 p-1 bg-emerald-50 rounded" title="View Result">
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
                                                        <div className="font-semibold text-teal-900">{lab.testName}</div>
                                                        <div className="text-xs text-neutral-500">Requested: {formatDate(lab.requested_at)}</div>
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
                                                        <div className="font-semibold text-emerald-900 flex items-center gap-2">
                                                            <Pill className="h-4 w-4" /> {med.medicineName}
                                                        </div>
                                                        <div className="text-xs text-neutral-500 mt-1">
                                                            Issued: {formatDate(med.issued_at)}
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

            {/* Review before completing: completing creates the bill and cannot be undone */}
            <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Complete this consultation?</DialogTitle>
                        <DialogDescription>Check what will be sent. Completing creates the bill and cannot be reopened.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 text-sm">
                        {!notes.trim() && (
                            <p role="alert" className="flex items-start gap-2 rounded-md bg-amber-50 p-2.5 font-medium text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> There are no clinical notes. Add a diagnosis or observations before completing.</p>
                        )}
                        <section>
                            <h3 className="mb-1 font-semibold">Medicines ({currentPrescription.length})</h3>
                            {currentPrescription.length === 0 ? <p className="text-neutral-600">None prescribed.</p> : (
                                <ul className="space-y-2">
                                    {currentPrescription.map((p, i) => {
                                        const med = medicines.find(m => m.id === p.medicineId);
                                        return (
                                            <li key={i} className="rounded-md border p-2">
                                                <p className="font-medium">{p.medicineName}</p>
                                                <p className="text-neutral-700">{describeLine({ form: med ? medicineForm(med) : 'Pill', times: p.frequency.split('-'), duration: p.duration, quantity: p.quantity, asNeeded: p.asNeeded, foodTiming: p.foodTiming, instructions: p.instructions })}</p>
                                                {acknowledged.includes(p.medicineId) && <p className="mt-0.5 text-xs font-semibold text-red-800">Prescribed despite an allergy warning (recorded).</p>}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>
                        <section>
                            <h3 className="mb-1 font-semibold">Lab tests ({selectedLabs.length})</h3>
                            {selectedLabs.length === 0 ? <p className="text-neutral-600">None requested.</p> : <p className="text-neutral-700">{selectedLabs.map(id => labById(id)?.name ?? savedLab(id)?.name).filter(Boolean).join(', ')}</p>}
                        </section>
                        <section className="rounded-md bg-neutral-50 p-3">
                            <h3 className="mb-1 font-semibold">Added to the patient&apos;s bill (estimate)</h3>
                            <p className="flex justify-between"><span>Medicines</span><span className="tabular-nums">{formatLKR(medicineCost)}</span></p>
                            <p className="flex justify-between"><span>Lab tests</span><span className="tabular-nums">{formatLKR(labTotal)}</span></p>
                            <p className="mt-1 text-xs text-neutral-600">Plus your consultation fee and the service charge. Medicines are billed as dispensed.</p>
                        </section>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={saving}>Back to editing</Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleSave(true)} disabled={saving}>{saving ? 'Completing…' : 'Complete consultation'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
