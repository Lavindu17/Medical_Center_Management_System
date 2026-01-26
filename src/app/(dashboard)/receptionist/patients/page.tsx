
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label'; // Added Label import
import { Search, UserPlus, Link as LinkIcon, Edit } from 'lucide-react';
import Link from 'next/link';

export default function PatientDirectory() {
    const [patients, setPatients] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [isLinkOpen, setIsLinkOpen] = useState(false);
    const [primaryPatient, setPrimaryPatient] = useState<any>(null);
    const [linkSearch, setLinkSearch] = useState('');
    const [linkResults, setLinkResults] = useState<any[]>([]);
    const [selectedLinkPatient, setSelectedLinkPatient] = useState<any>(null);
    const [relationship, setRelationship] = useState('PARENT');

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchPatients();
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (linkSearch.length > 2) {
                const res = await fetch(`/api/receptionist/patients?q=${linkSearch}`);
                if (res.ok) setLinkResults(await res.json());
            } else {
                setLinkResults([]); // Clear results if search term is too short
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [linkSearch]);

    const fetchPatients = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/receptionist/patients?q=${search}`);
            if (res.ok) {
                setPatients(await res.json());
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const openLinkDialog = (patient: any) => {
        setPrimaryPatient(patient);
        setIsLinkOpen(true);
        setLinkSearch('');
        setLinkResults([]);
        setSelectedLinkPatient(null);
        setRelationship('PARENT'); // Reset relationship
    };

    const handleLink = async () => {
        if (!primaryPatient || !selectedLinkPatient) return;
        try {
            const res = await fetch('/api/receptionist/patients/link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    primary_patient_id: primaryPatient.id,
                    linked_patient_id: selectedLinkPatient.id,
                    relationship
                })
            });

            if (res.ok) {
                alert('Linked Successfully');
                setIsLinkOpen(false);
                // Optionally, re-fetch patients or update UI to reflect the link
            } else {
                const data = await res.json();
                alert(data.message || 'Failed to link');
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-neutral-900">Patient Directory</h1>
                    <p className="text-neutral-500">Manage patient records and accounts.</p>
                </div>
                <Link href="/receptionist/register">
                    <Button className="bg-emerald-600 hover:bg-emerald-700">
                        <UserPlus className="mr-2 h-4 w-4" /> New Patient
                    </Button>
                </Link>
            </div>

            <div className="flex gap-4">
                <div className="relative max-w-md flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                    <Input
                        placeholder="Search by name, phone, or email..."
                        className="pl-9"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b bg-neutral-50 font-semibold text-sm text-neutral-500">
                    <div className="col-span-3">Name</div>
                    <div className="col-span-3">Contact</div>
                    <div className="col-span-2">Date of Birth</div>
                    <div className="col-span-2">Gender</div>
                    <div className="col-span-2 text-right">Actions</div>
                </div>
                <div className="divide-y">
                    {loading ? <div className="p-8 text-center text-neutral-400">Loading...</div> : patients.length === 0 ? <div className="p-8 text-center text-neutral-500">No patients found.</div> : patients.map((patient) => (
                        <div key={patient.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-neutral-50 transition-colors">
                            <div className="col-span-3 font-medium text-neutral-900">{patient.name}</div>
                            <div className="col-span-3">
                                <div className="text-sm text-neutral-900">{patient.email}</div>
                                <div className="text-xs text-neutral-500">{patient.phone}</div>
                            </div>
                            <div className="col-span-2 text-sm text-neutral-600">{new Date(patient.date_of_birth).toLocaleDateString()}</div>
                            <div className="col-span-2 text-sm text-neutral-600">{patient.gender}</div>
                            <div className="col-span-2 flex justify-end gap-2">
                                <Button size="sm" variant="ghost" className="text-blue-600" onClick={() => openLinkDialog(patient)} title="Link Family">
                                    <LinkIcon className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="text-blue-600" title="Edit">
                                    <Edit className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Link Dialog */}
            {isLinkOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-full max-w-md space-y-4">
                        <h3 className="text-lg font-bold">Link Family Member</h3>
                        <p className="text-sm text-neutral-500">Linking to: <strong>{primaryPatient?.name}</strong></p>

                        <div className="space-y-2">
                            <Label htmlFor="link-search">Search Relative</Label>
                            <Input id="link-search" placeholder="Type name..." value={linkSearch} onChange={e => setLinkSearch(e.target.value)} />
                            <div className="border rounded max-h-32 overflow-y-auto">
                                {linkResults.length === 0 ? (
                                    <div className="p-2 text-sm text-neutral-500">No results. Type more to search.</div>
                                ) : (
                                    linkResults.map(p => (
                                        p.id !== primaryPatient?.id && ( // Prevent linking a patient to themselves
                                            <div
                                                key={p.id}
                                                className={`p-2 text-sm cursor-pointer hover:bg-neutral-100 ${selectedLinkPatient?.id === p.id ? 'bg-blue-50' : ''}`}
                                                onClick={() => setSelectedLinkPatient(p)}
                                            >
                                                {p.name} ({p.phone})
                                            </div>
                                        )
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="relationship-select">Relationship</Label>
                            <select id="relationship-select" className="w-full border rounded p-2 text-sm" value={relationship} onChange={e => setRelationship(e.target.value)}>
                                <option value="PARENT">Parent</option>
                                <option value="CHILD">Child</option>
                                <option value="SPOUSE">Spouse</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="ghost" onClick={() => setIsLinkOpen(false)}>Cancel</Button>
                            <Button onClick={handleLink} disabled={!selectedLinkPatient} className="bg-emerald-600">Link Accounts</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
