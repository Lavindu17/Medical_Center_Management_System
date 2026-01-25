'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Edit2, Trash2, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function InventoryPage() {
    const [medicines, setMedicines] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Form State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isRestockOpen, setIsRestockOpen] = useState(false);
    const [currentMed, setCurrentMed] = useState<any>(null);
    const [formData, setFormData] = useState({
        name: '',
        generic_name: '',
        manufacturer: '',
        category: '',
        location: '',
        stock: '',
        min_stock_level: '10',
        unit: 'tablets',
        dosage_form: '',
        strength: '',
        price_per_unit: '',
        buying_price: '',
        expiry_date: ''
    });
    const [restockForm, setRestockForm] = useState({
        batch_number: '',
        quantity: '',
        buying_price: '',
        selling_price: '',
        expiry_date: ''
    });

    // Batches State
    const [batches, setBatches] = useState<any[]>([]);
    const [isBatchesOpen, setIsBatchesOpen] = useState(false);

    useEffect(() => {
        fetchMedicines();
    }, []);

    const fetchBatches = async (medId: number) => {
        try {
            const res = await fetch(`/api/pharmacist/inventory/batch?medicineId=${medId}`);
            if (res.ok) {
                const data = await res.json();
                setBatches(data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const openBatches = (med: any) => {
        setCurrentMed(med);
        fetchBatches(med.id);
        setIsBatchesOpen(true);
    };

    const fetchMedicines = () => {
        fetch('/api/pharmacist/inventory')
            .then(res => res.json())
            .then(data => setMedicines(data))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    const handleSearch = medicines.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const url = isEditOpen ? `/api/pharmacist/inventory/${currentMed.id}` : '/api/pharmacist/inventory';
        const method = isEditOpen ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (res.ok) {
                fetchMedicines();
                setIsAddOpen(false);
                setIsEditOpen(false);
                resetForm();
            } else {
                alert('Error saving medicine');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this medicine?')) return;
        try {
            await fetch(`/api/pharmacist/inventory/${id}`, { method: 'DELETE' });
            fetchMedicines();
        } catch (err) {
            console.error(err);
        }
    };

    const openEdit = (med: any) => {
        setCurrentMed(med);
        setFormData({
            name: med.name,
            generic_name: med.generic_name || '',
            manufacturer: med.manufacturer || '',
            category: med.category || '',
            location: med.location || '',
            stock: med.stock,
            min_stock_level: med.min_stock_level || '10',
            unit: med.unit,
            dosage_form: med.dosage_form || '',
            strength: med.strength || '',
            price_per_unit: med.price_per_unit,
            buying_price: med.buying_price || '',
            expiry_date: med.expiry_date ? new Date(med.expiry_date).toISOString().split('T')[0] : ''
        });
        setIsEditOpen(true);
    };

    const resetForm = () => {
        setFormData({
            name: '',
            generic_name: '',
            manufacturer: '',
            category: '',
            location: '',
            stock: '',
            min_stock_level: '10',
            unit: 'tablets',
            dosage_form: '',
            strength: '',
            price_per_unit: '',
            buying_price: '',
            expiry_date: ''
        });
        setCurrentMed(null);
    };

    const openRestock = (med: any) => {
        setCurrentMed(med);
        setRestockForm({
            batch_number: '',
            quantity: '',
            buying_price: med.buying_price || '',
            selling_price: med.price_per_unit || '',
            expiry_date: ''
        });
        setIsRestockOpen(true);
    };

    const resetRestockForm = () => {
        setRestockForm({ batch_number: '', quantity: '', buying_price: '', selling_price: '', expiry_date: '' });
        setCurrentMed(null);
    };

    const handleRestockSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/pharmacist/inventory/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    medicine_id: currentMed.id,
                    ...restockForm
                })
            });

            if (res.ok) {
                fetchMedicines();
                setIsRestockOpen(false);
                resetRestockForm();
                alert('Stock Added Successfully');
            } else {
                alert('Failed to add batch');
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-neutral-900">Inventory</h1>
                    <p className="text-neutral-500">Manage medicine stocks and pricing.</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button className="bg-emerald-600 hover:bg-emerald-700">
                            <Plus className="mr-2 h-4 w-4" /> Add Medicine
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Add New Medicine</DialogTitle></DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                            <div className="space-y-2"><Label>Name</Label><Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>Generic Name</Label><Input value={formData.generic_name} onChange={e => setFormData({ ...formData, generic_name: e.target.value })} /></div>
                                <div className="space-y-2"><Label>Manufacturer</Label><Input value={formData.manufacturer} onChange={e => setFormData({ ...formData, manufacturer: e.target.value })} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>Category</Label><Input value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} placeholder="e.g. Antibiotic" /></div>
                                <div className="space-y-2"><Label>Location</Label><Input value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder="Shelf A1" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>Unit</Label><Input required value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} placeholder="e.g. tablets" /></div>
                                <div className="space-y-2"><Label>Min Stock Level</Label><Input type="number" value={formData.min_stock_level} onChange={e => setFormData({ ...formData, min_stock_level: e.target.value })} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Dosage Form</Label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        value={formData.dosage_form}
                                        onChange={e => setFormData({ ...formData, dosage_form: e.target.value })}
                                    >
                                        <option value="">Select...</option>
                                        <option value="TABLET">Tablet</option>
                                        <option value="SYRUP">Syrup</option>
                                        <option value="CAPSULE">Capsule</option>
                                        <option value="INJECTION">Injection</option>
                                        <option value="CREAM">Cream</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </div>
                                <div className="space-y-2"><Label>Strength</Label><Input value={formData.strength} onChange={e => setFormData({ ...formData, strength: e.target.value })} placeholder="e.g. 500mg" /></div>
                            </div>
                            {/* Standard Selling Price is optional but good for default. Buying Price and Stock are batch specific. */}
                            <div className="space-y-2"><Label>Standard Selling Price ($)</Label><Input type="number" step="0.01" required value={formData.price_per_unit} onChange={e => setFormData({ ...formData, price_per_unit: e.target.value })} /></div>

                            <Button type="submit" className="w-full bg-emerald-600">Register Medicine</Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="flex gap-4 mb-6">
                <div className="relative max-w-md flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                    <Input placeholder="Search inventory..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </div>

            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b bg-neutral-50 font-semibold text-sm text-neutral-500">
                    <div className="col-span-4">Medicine Name</div>
                    <div className="col-span-2">Stock</div>
                    <div className="col-span-2">Price (Sell)</div>
                    <div className="col-span-2">Expiry</div>
                    <div className="col-span-2 text-right">Actions</div>
                </div>
                <div className="divide-y">
                    {loading ? <div className="p-8 text-center text-neutral-400">Loading...</div> : handleSearch.map((med) => (
                        <div key={med.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-neutral-50 transition-colors">
                            <div className="col-span-4 font-medium text-neutral-900">{med.name}</div>
                            <div className="col-span-2">
                                <span className={`font-mono font-bold ${med.stock < 20 ? 'text-red-600' : 'text-emerald-700'}`}>
                                    {med.stock}
                                </span> <span className="text-xs text-neutral-400">{med.unit}</span>
                            </div>
                            <div className="col-span-2 text-neutral-700">${med.price_per_unit}</div>
                            <div className="col-span-2 text-sm text-neutral-600">
                                {med.earliest_expiry
                                    ? new Date(med.earliest_expiry).toLocaleDateString()
                                    : <span className="text-neutral-400 italic">No Stock</span>}
                            </div>
                            <div className="col-span-2 flex justify-end gap-2">
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-neutral-500" onClick={() => openBatches(med)} title="View Batches">
                                    <Search className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={() => openRestock(med)} title="Restock">
                                    <Package className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={() => openEdit(med)}>
                                    <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => handleDelete(med.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* View Batches Dialog */}
            <Dialog open={isBatchesOpen} onOpenChange={setIsBatchesOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader><DialogTitle>Batch History: {currentMed?.name}</DialogTitle></DialogHeader>
                    <div className="border rounded-md overflow-hidden mt-4">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-neutral-50 text-neutral-500 font-semibold border-b">
                                <tr>
                                    <th className="p-3">Batch #</th>
                                    <th className="p-3">Expiry</th>
                                    <th className="p-3">Qty (Initial)</th>
                                    <th className="p-3">Qty (Current)</th>
                                    <th className="p-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {batches.map(b => (
                                    <tr key={b.id} className="hover:bg-neutral-50">
                                        <td className="p-3 font-medium">{b.batch_number}</td>
                                        <td className="p-3">{new Date(b.expiry_date).toLocaleDateString()}</td>
                                        <td className="p-3 text-neutral-500">{b.quantity_initial}</td>
                                        <td className="p-3 font-bold">{b.quantity_current}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-xs border ${b.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                b.status === 'EXPIRED' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-neutral-100 text-neutral-500'
                                                }`}>{b.status}</span>
                                        </td>
                                    </tr>
                                ))}
                                {batches.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-neutral-400">No batches found</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog - No Stock Editing */}
            <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) resetForm(); }}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Edit Medicine Details</DialogTitle></DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                        <div className="space-y-2"><Label>Name</Label><Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Generic Name</Label><Input value={formData.generic_name} onChange={e => setFormData({ ...formData, generic_name: e.target.value })} /></div>
                            <div className="space-y-2"><Label>Manufacturer</Label><Input value={formData.manufacturer} onChange={e => setFormData({ ...formData, manufacturer: e.target.value })} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Category</Label><Input value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} /></div>
                            <div className="space-y-2"><Label>Unit</Label><Input required value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} /></div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Buying Price ($)</Label><Input type="number" step="0.01" value={formData.buying_price} onChange={e => setFormData({ ...formData, buying_price: e.target.value })} /></div>
                            <div className="space-y-2"><Label>Selling Price ($)</Label><Input type="number" step="0.01" required value={formData.price_per_unit} onChange={e => setFormData({ ...formData, price_per_unit: e.target.value })} /></div>
                        </div>
                        <div className="space-y-2"><Label>Expiry Date (Master)</Label><Input type="date" required value={formData.expiry_date} onChange={e => setFormData({ ...formData, expiry_date: e.target.value })} /></div>
                        <Button type="submit" className="w-full bg-blue-600">Update Details</Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Restock Dialog (Add Batch) */}
            <Dialog open={isRestockOpen} onOpenChange={(open) => { setIsRestockOpen(open); if (!open) resetRestockForm(); }}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Restock (Add Batch)</DialogTitle></DialogHeader>
                    {currentMed && <p className="text-sm text-neutral-500 mb-4">Adding stock for: <strong>{currentMed.name}</strong></p>}
                    <form onSubmit={handleRestockSubmit} className="space-y-4">
                        <div className="space-y-2"><Label>Batch Number</Label><Input placeholder="Auto-generated if empty" value={restockForm.batch_number} onChange={e => setRestockForm({ ...restockForm, batch_number: e.target.value })} /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Quantity</Label><Input type="number" required value={restockForm.quantity} onChange={e => setRestockForm({ ...restockForm, quantity: e.target.value })} /></div>
                            <div className="space-y-2"><Label>Expiry Date</Label><Input type="date" required value={restockForm.expiry_date} onChange={e => setRestockForm({ ...restockForm, expiry_date: e.target.value })} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Buying Price ($)</Label><Input type="number" step="0.01" value={restockForm.buying_price} onChange={e => setRestockForm({ ...restockForm, buying_price: e.target.value })} /></div>
                            <div className="space-y-2"><Label>Selling Price ($)</Label><Input type="number" step="0.01" value={restockForm.selling_price} onChange={e => setRestockForm({ ...restockForm, selling_price: e.target.value })} /></div>
                        </div>
                        <Button type="submit" className="w-full bg-emerald-600">Add Batch</Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
