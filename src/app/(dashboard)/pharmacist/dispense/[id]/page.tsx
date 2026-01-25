
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Link, ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default function DispensePage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [itemsToDispense, setItemsToDispense] = useState<any[]>([]);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetch(`/api/pharmacist/dispense/${params.id}`)
            .then(res => res.json())
            .then(resData => {
                if (resData.error) {
                    alert(resData.error);
                    router.push('/pharmacist/prescriptions');
                    return;
                }
                setData(resData);
                // Initialize state with default quantities
                setItemsToDispense(resData.items.map((item: any) => ({
                    medicine_id: item.medicine_id,
                    quantity_to_dispense: item.prescribed_quantity,
                    price: item.selling_price
                })));
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [params.id, router]);

    const handleQuantityChange = (medicineId: number, qty: number) => {
        setItemsToDispense(prev =>
            prev.map(item => item.medicine_id === medicineId ? { ...item, quantity_to_dispense: qty } : item)
        );
    };

    const handleRemoveItem = (medicineId: number) => {
        setItemsToDispense(prev => prev.filter(item => item.medicine_id !== medicineId));
    };

    const handleRestoreItem = (item: any) => {
        setItemsToDispense(prev => [
            ...prev,
            {
                medicine_id: item.medicine_id,
                quantity_to_dispense: item.prescribed_quantity,
                price: item.selling_price
            }
        ]);
    };

    const calculateTotal = () => {
        return itemsToDispense.reduce((acc, item) => acc + (item.quantity_to_dispense * item.price), 0);
    };

    const handleDispense = async () => {
        if (!confirm('Confirm dispensing items? This will deduct stock and update the bill.')) return;

        setSubmitting(true);
        try {
            const res = await fetch(`/api/pharmacist/dispense/${params.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: itemsToDispense })
            });

            if (res.ok) {
                alert('Dispensed Successfully!');
                router.push('/pharmacist/prescriptions');
            } else {
                const err = await res.json();
                alert('Error: ' + err.error);
            }
        } catch (e) {
            console.error(e);
            alert('Failed to process');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8">Loading...</div>;
    if (!data) return <div className="p-8">Prescription not found</div>;

    const { prescription, items } = data;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                <h1 className="text-3xl font-bold text-neutral-900">Dispense Prescription</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Patient Details */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Patient Details</h3>
                        <div>
                            <p className="text-sm text-neutral-500">Name</p>
                            <p className="font-medium text-lg">{prescription.patient_name}</p>
                        </div>
                        <div>
                            <p className="text-sm text-neutral-500">Doctor</p>
                            <p className="font-medium">Dr. {prescription.doctor_name}</p>
                        </div>
                        <div>
                            <p className="text-sm text-neutral-500">Date</p>
                            <p className="font-medium">{new Date(prescription.created_at).toLocaleDateString()}</p>
                        </div>
                        <Badge variant="outline" className="mt-2 text-amber-700 bg-amber-50">
                            {prescription.status}
                        </Badge>
                    </div>
                </div>

                {/* Dispensing Form */}
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-xl border shadow-sm">
                        <h3 className="font-semibold text-lg border-b pb-4 mb-4">Prescribed Items</h3>

                        <div className="space-y-6">
                            {items.map((item: any, index: number) => {
                                const stockAvailable = item.current_stock >= item.prescribed_quantity;
                                const currentDispense = itemsToDispense.find(i => i.medicine_id === item.medicine_id);

                                return (
                                    <div key={item.item_id} className="p-4 bg-neutral-50 rounded-lg border">
                                        <div className="flex justify-between mb-2">
                                            <div>
                                                <p className="font-bold text-neutral-800">{item.medicine_name}</p>
                                                <p className="text-sm text-neutral-500">{item.dosage} - {item.frequency} for {item.duration}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-mono text-lg font-bold text-emerald-700">${item.selling_price}</p>
                                                <p className="text-xs text-neutral-400">per unit</p>
                                            </div>
                                        </div>

                                        <div className="flex items-end gap-4 mt-4">
                                            <div className="flex-1">
                                                <p className="text-xs font-semibold text-neutral-500 mb-1">Stock Status</p>
                                                {stockAvailable ? (
                                                    <span className="flex items-center text-sm text-emerald-600">
                                                        <CheckCircle className="h-4 w-4 mr-1" /> Available ({item.current_stock})
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center text-sm text-red-600 font-bold">
                                                        <AlertTriangle className="h-4 w-4 mr-1" /> Low Stock ({item.current_stock})
                                                    </span>
                                                )}
                                            </div>

                                            <div className="w-32">
                                                <p className="text-xs font-semibold text-neutral-500 mb-1">Prescribed</p>
                                                <div className="bg-neutral-200 px-3 py-2 rounded text-center font-mono text-sm">
                                                    {item.prescribed_quantity}
                                                </div>
                                            </div>

                                            <div className="w-32">
                                                <p className="text-xs font-semibold text-neutral-700 mb-1">To Dispense</p>
                                                {currentDispense ? (
                                                    <input
                                                        type="number"
                                                        className="w-full border rounded px-3 py-2 text-center"
                                                        value={currentDispense.quantity_to_dispense}
                                                        onChange={(e) => handleQuantityChange(item.medicine_id, Number(e.target.value))}
                                                        max={item.current_stock}
                                                    />
                                                ) : (
                                                    <div className="text-xs text-red-500 italic py-2 text-center">Removed</div>
                                                )}

                                            </div>

                                            <div>
                                                {currentDispense ? (
                                                    <Button variant="ghost" size="sm" className="text-red-500 h-10 px-2" onClick={() => handleRemoveItem(item.medicine_id)}>
                                                        Remove
                                                    </Button>
                                                ) : (
                                                    <Button variant="ghost" size="sm" className="text-emerald-600 h-10 px-2" onClick={() => handleRestoreItem(item)}>
                                                        Restore
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <Separator className="my-6" />

                        <div className="flex justify-between items-center">
                            <div className="text-right flex-1 pr-4">
                                <p className="text-sm text-neutral-500">Total Pharmacy Cost</p>
                                <p className="text-2xl font-bold text-neutral-900">${calculateTotal().toFixed(2)}</p>
                            </div>
                            <Button
                                className="bg-emerald-600 hover:bg-emerald-700 h-12 px-8 text-lg"
                                onClick={handleDispense}
                                disabled={submitting}
                            >
                                {submitting ? 'Processing...' : 'Confirm Dispense'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
