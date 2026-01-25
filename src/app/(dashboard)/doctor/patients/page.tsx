'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, User, FileText, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function DoctorPatientsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [patients, setPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchPatients();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const fetchPatients = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/doctor/patients?search=${searchTerm}`);
            if (res.ok) {
                setPatients(await res.json());
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-neutral-900">Patient Directory</h1>
                <p className="text-neutral-500">Search global patient records and medical history.</p>
            </div>

            <div className="relative max-w-lg">
                <Search className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
                <Input
                    placeholder="Search by Name or Phone..."
                    className="pl-9 h-10"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b bg-neutral-50 font-semibold text-sm text-neutral-500">
                    <div className="col-span-4">Patient Name</div>
                    <div className="col-span-3">Contact</div>
                    <div className="col-span-2">Age/Gender</div>
                    <div className="col-span-3 text-right">Action</div>
                </div>

                <div className="divide-y">
                    {loading ? (
                        <div className="p-8 text-center text-neutral-400">Searching...</div>
                    ) : patients.length === 0 ? (
                        <div className="p-12 text-center text-neutral-400">No patients found.</div>
                    ) : (
                        patients.map(patient => ( // Explicitly any in state definition, implied here
                            <div key={patient.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-neutral-50 transition-colors">
                                <div className="col-span-4 flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                                        {patient.name.charAt(0)}
                                    </div>
                                    <span className="font-medium text-neutral-900">{patient.name}</span>
                                </div>
                                <div className="col-span-3 text-sm text-neutral-600">
                                    {patient.phone || patient.email || '-'}
                                </div>
                                <div className="col-span-2 text-sm text-neutral-600">
                                    {calculateAge(patient.date_of_birth)} yrs • {patient.gender}
                                </div>
                                <div className="col-span-3 flex justify-end">
                                    <Link href={`/doctor/patients/${patient.id}`}>
                                        <Button size="sm" variant="outline" className="gap-2">
                                            <FileText className="h-4 w-4" /> View History
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        ))
                    )}
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
