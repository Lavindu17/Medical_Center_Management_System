'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Edit, Stethoscope, DollarSign } from 'lucide-react';

interface DoctorData {
    id: number;
    name: string;
    email: string;
    specialization: string;
    licenseNumber: string;
    consultationFee: number;
    commissionRate: number;
}

export default function DoctorManagementPage() {
    const [doctors, setDoctors] = useState<DoctorData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [selectedDoctor, setSelectedDoctor] = useState<DoctorData | null>(null);

    // Edit form state
    const [editForm, setEditForm] = useState({ consultationFee: '', commissionRate: '' });

    useEffect(() => {
        fetchDoctors();
    }, []);

    async function fetchDoctors() {
        try {
            const res = await fetch('/api/admin/doctors');
            const data = await res.json();
            setDoctors(data);
        } catch (error) {
            console.error('Failed to fetch doctors', error);
        } finally {
            setIsLoading(false);
        }
    }

    const handleEditClick = (doc: DoctorData) => {
        setSelectedDoctor(doc);
        setEditForm({
            consultationFee: doc.consultationFee.toString(),
            commissionRate: doc.commissionRate.toString(),
        });
        setIsEditOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDoctor) return;

        try {
            const res = await fetch('/api/admin/doctors', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedDoctor.id,
                    consultationFee: parseFloat(editForm.consultationFee),
                    commissionRate: parseFloat(editForm.commissionRate),
                }),
            });

            if (!res.ok) throw new Error('Failed to update');

            setIsEditOpen(false);
            fetchDoctors(); // Refresh list associated
        } catch (error) {
            alert('Error updating doctor');
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Doctor Management</h2>
                <p className="text-neutral-500">Set consultation fees and view earnings configuration.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
                <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-300">Total Doctors</CardTitle>
                        <Stethoscope className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{doctors.length}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Medical Staff Financials</CardTitle>
                    <CardDescription>
                        Manage fees and commission rates for each doctor.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Doctor Name</TableHead>
                                <TableHead>Specialization</TableHead>
                                <TableHead>Fee ($)</TableHead>
                                <TableHead>Commission (%)</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="text-center h-24">Loading...</TableCell></TableRow>
                            ) : doctors.map((doc) => (
                                <TableRow key={doc.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex flex-col">
                                            <span>{doc.name}</span>
                                            <span className="text-xs text-neutral-500">{doc.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{doc.specialization}</Badge>
                                    </TableCell>
                                    <TableCell className="font-mono">${Number(doc.consultationFee).toFixed(2)}</TableCell>
                                    <TableCell className="font-mono">{doc.commissionRate}%</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(doc)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!isLoading && doctors.length === 0 && (
                                <TableRow><TableCell colSpan={5} className="text-center h-24 text-neutral-500">No doctors found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Financial Settings</DialogTitle>
                        <DialogDescription>
                            Update fees for {selectedDoctor?.name}.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Consultation Fee ($)</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-neutral-500" />
                                    <Input
                                        className="pl-8"
                                        type="number"
                                        step="0.01"
                                        value={editForm.consultationFee}
                                        onChange={(e) => setEditForm({ ...editForm, consultationFee: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Commission Rate (%)</Label>
                                <div className="relative">
                                    <span className="absolute right-3 top-2.5 text-sm text-neutral-500">%</span>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        value={editForm.commissionRate}
                                        onChange={(e) => setEditForm({ ...editForm, commissionRate: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit">Save Changes</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
