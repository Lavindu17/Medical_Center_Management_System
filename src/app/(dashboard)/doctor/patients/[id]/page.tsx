'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, History, FileText } from 'lucide-react';

export default function PatientHistoryPage() {
    const params = useParams();
    const router = useRouter();
    const patientId = params.id;

    const [patient, setPatient] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // We can reuse the consultation ID API if we have an appointment ID, OR create a new endpoint for just patient ID.
        // Let's create a specific fetcher or reuse logic. 
        // Better: create '/api/doctor/patients/[id]' to fetch history by patient ID.

        async function load() {
            try {
                const res = await fetch(`/api/doctor/patients/${patientId}`);
                if (res.ok) {
                    const data = await res.json();
                    setPatient(data.patient);
                    setHistory(data.history);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [patientId]);

    if (loading) return <div className="p-8">Loading Record...</div>;
    if (!patient) return <div className="p-8">Patient not found</div>;

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold text-neutral-900">{patient.name}</h1>
                    <p className="text-neutral-500">Medical Record</p>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
                {/* Left: Demographics */}
                <div className="col-span-1 space-y-6">
                    <Card>
                        <CardHeader className="bg-blue-50">
                            <CardTitle className="text-blue-900">Demographics</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-3">
                            <div className="text-sm">
                                <span className="text-neutral-500 block">ID</span>
                                <span className="font-mono font-bold text-neutral-800">#{patient.id}</span>
                            </div>
                            <div className="text-sm">
                                <span className="text-neutral-500 block">Age / Gender</span>
                                <span className="font-medium">{calculateAge(patient.date_of_birth)} yrs • {patient.gender}</span>
                            </div>
                            <div className="text-sm">
                                <span className="text-neutral-500 block">Contact</span>
                                <span className="font-medium">{patient.phone || patient.email}</span>
                            </div>
                            <div className="text-sm">
                                <span className="text-neutral-500 block">Address</span>
                                <span className="font-medium">{patient.address || '-'}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Medical History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-neutral-700">{patient.medical_history || 'No chronic conditions recorded.'}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Right: Visit History */}
                <div className="col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <History className="h-5 w-5 text-neutral-500" /> Visit History
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {history.length === 0 ? (
                                <div className="p-8 text-center text-neutral-500">No previous visits found.</div>
                            ) : (
                                <div className="divide-y">
                                    {history.map((visit) => (
                                        <div key={visit.id} className="p-4 hover:bg-neutral-50 transition-colors">
                                            <div className="flex justify-between mb-2">
                                                <span className="font-bold text-neutral-800">{new Date(visit.date).toLocaleDateString()}</span>
                                                <span className="text-sm text-neutral-500">{visit.time_slot}</span>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="text-sm">
                                                    <span className="font-semibold text-blue-800">Diagnosis/Notes:</span>
                                                    <p className="text-neutral-700 mt-0.5 whitespace-pre-wrap">{visit.notes || 'No notes'}</p>
                                                </div>

                                                {visit.prescriptions && visit.prescriptions.length > 0 && (
                                                    <div className="bg-gray-50 p-3 rounded text-sm mt-3 border">
                                                        <span className="font-semibold text-neutral-600 flex items-center gap-2 mb-2">
                                                            <FileText className="h-3 w-3" /> Prescribed Medicines:
                                                        </span>
                                                        <ul className="list-disc list-inside text-neutral-700 space-y-1">
                                                            {visit.prescriptions.map((p: any) => (
                                                                <li key={p.id}>
                                                                    {p.medicineName} - {p.dosage} ({p.frequency})
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function calculateAge(dob: string) {
    if (!dob) return '-';
    const diff = Date.now() - new Date(dob).getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
}
