'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Edit2, Trash2, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { formatLKR } from '@/lib/utils';

export default function InventoryPage() {
    const [medicines, setMedicines] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
    const [stockFilter, setStockFilter] = useState<string>('ALL');

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
        min_stock_level: '10',
        unit: 'tablets',
        dosage_form: '',
        strength: '',
        price_per_unit: ''
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

    const handleSearch = medicines.filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (m.generic_name && m.generic_name.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesCategory = categoryFilter === 'ALL' || m.category === categoryFilter;
        const matchesStock = stockFilter === 'ALL' ||
            (stockFilter === 'LOW' && m.batch_stock <= m.min_stock_level) ||
            (stockFilter === 'OUT' && m.batch_stock === 0);
        return matchesSearch && matchesCategory && matchesStock;
    });

    const categories = ['ALL', ...new Set(medicines.map(m => m.category).filter(Boolean))];

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
            min_stock_level: med.min_stock_level || '10',
            unit: med.unit,
            dosage_form: med.dosage_form || '',
            strength: med.strength || '',
            price_per_unit: med.price_per_unit
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
            min_stock_level: '10',
            unit: 'tablets',
            dosage_form: '',
            strength: '',
            price_per_unit: ''
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
                            <div className="space-y-2">
                                <Label>Standard Selling Price per Unit (LKR) *</Label>
                                <Input type="number" step="0.01" required value={formData.price_per_unit} onChange={e => setFormData({ ...formData, price_per_unit: e.target.value })} placeholder="e.g., 15.50" />
                                <p className="text-xs text-neutral-500">Price per single {formData.unit || 'unit'} (not per batch)</p>
                            </div>

                            <Button type="submit" className="w-full bg-emerald-600">Register Medicine</Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Enhanced Search and Filters */}
            <div className="bg-white rounded-lg border p-4 shadow-sm">
                <div className="flex flex-wrap gap-4">
                    <div className="relative flex-1 min-w-[300px]">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                        <Input
                            placeholder="Search by name or generic name..."
                            className="pl-9"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <select
                        className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 min-w-[160px]"
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                    >
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat === 'ALL' ? 'All Categories' : cat}</option>
                        ))}
                    </select>

                    <select
                        className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 min-w-[160px]"
                        value={stockFilter}
                        onChange={e => setStockFilter(e.target.value)}
                    >
                        <option value="ALL">All Stock Levels</option>
                        <option value="LOW">Low Stock Only</option>
                        <option value="OUT">Out of Stock</option>
                    </select>

                    {(searchTerm || categoryFilter !== 'ALL' || stockFilter !== 'ALL') && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSearchTerm(''); setCategoryFilter('ALL'); setStockFilter('ALL'); }}
                            className="text-neutral-500 hover:text-neutral-700"
                        >
                            Clear Filters
                        </Button>
                    )}
                </div>
                <div className="mt-3 text-xs text-neutral-500 flex items-center gap-2">
                    <span>Showing {handleSearch.length} of {medicines.length} medicines</span>
                    {stockFilter === 'LOW' && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">Low Stock Filter Active</span>}
                    {stockFilter === 'OUT' && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">Out of Stock Filter Active</span>}
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
                        <div key={med.id} className="grid grid-cols-12 gap-4 px-6 py-5 items-center hover:bg-emerald-50/30 transition-colors group">
                            <div className="col-span-4">
                                <div className="font-semibold text-neutral-900 group-hover:text-emerald-700 transition-colors">{med.name}</div>
                                {med.generic_name && <div className="text-sm text-neutral-500 mt-0.5">{med.generic_name}</div>}
                                {med.category && <div className="text-xs text-neutral-400 mt-1">🏷️ {med.category}</div>}
                            </div>
                            <div className="col-span-2">
                                {/* Stock Level with Progress Bar */}
                                <div className="space-y-2">
                                    <div className="flex items-baseline gap-2">
                                        <span className={`font-mono font-bold text-lg ${med.batch_stock === 0 ? 'text-red-700' :
                                            med.batch_stock <= (med.min_stock_level * 0.5) ? 'text-red-600' :
                                                med.batch_stock <= med.min_stock_level ? 'text-amber-600' :
                                                    'text-emerald-700'
                                            }`}>
                                            {med.batch_stock || 0}
                                        </span>
                                        <span className="text-xs text-neutral-400">/ {med.min_stock_level}</span>
                                        <span className="text-xs text-neutral-500">{med.unit}</span>
                                    </div>
                                    {/* Progress Bar */}
                                    <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-300 ${med.batch_stock === 0 ? 'bg-red-600' :
                                                med.batch_stock <= (med.min_stock_level * 0.5) ? 'bg-red-500' :
                                                    med.batch_stock <= med.min_stock_level ? 'bg-amber-500' :
                                                        'bg-emerald-600'
                                                }`}
                                            style={{ width: `${Math.min((med.batch_stock / med.min_stock_level) * 100, 100)}%` }}
                                        />
                                    </div>
                                    {/* Status Label */}
                                    {med.batch_stock === 0 && (
                                        <div className="text-xs font-bold text-red-700">OUT OF STOCK</div>
                                    )}
                                    {med.batch_stock > 0 && med.batch_stock <= (med.min_stock_level * 0.5) && (
                                        <div className="text-xs font-bold text-red-600">CRITICAL</div>
                                    )}
                                    {med.batch_stock > (med.min_stock_level * 0.5) && med.batch_stock <= med.min_stock_level && (
                                        <div className="text-xs font-semibold text-amber-600">LOW STOCK</div>
                                    )}
                                </div>
                            </div>
                            <div className="col-span-2">
                                <div className="font-semibold text-neutral-900">{formatLKR(med.price_per_unit)}</div>
                                <div className="text-xs text-neutral-500">per {med.unit}</div>
                            </div>
                            <div className="col-span-2">
                                {med.earliest_expiry ? (
                                    (() => {
                                        const expiryDate = new Date(med.earliest_expiry);
                                        const today = new Date();
                                        const daysUntil = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                        const isExpired = daysUntil < 0;
                                        const isExpiringSoon = daysUntil >= 0 && daysUntil < 30;
                                        const isExpiringLater = daysUntil >= 30 && daysUntil < 90;

                                        return (
                                            <div>
                                                <div className={`text-sm font-medium ${isExpired ? 'text-red-700 font-bold' :
                                                    isExpiringSoon ? 'text-amber-700' :
                                                        isExpiringLater ? 'text-amber-600' :
                                                            'text-neutral-700'
                                                    }`}>
                                                    {expiryDate.toLocaleDateString()}
                                                </div>
                                                <div className={`text-xs font-semibold mt-0.5 ${isExpired ? 'text-red-600' :
                                                    isExpiringSoon ? 'text-amber-600' :
                                                        'text-neutral-500'
                                                    }`}>
                                                    {isExpired ? '⚠️ EXPIRED' : `${daysUntil}d remaining`}
                                                </div>
                                            </div>
                                        );
                                    })()
                                ) : (
                                    <span className="text-neutral-400 text-sm italic">No stock</span>
                                )}
                            </div>
                            <div className="col-span-2 flex gap-2 justify-end">
                                <Button size="sm" variant="outline" onClick={() => openBatches(med)} className="border-emerald-600 text-emerald-700 hover:bg-emerald-50" title="View Batches">
                                    <Package className="h-4 w-4 mr-1" /> Batches
                                </Button>
                                <Button size="sm" onClick={() => openRestock(med)} className="bg-emerald-600 hover:bg-emerald-700">
                                    Restock
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => openEdit(med)} className="hover:bg-neutral-100">
                                    <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(med.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* View Batches Dialog */}
            <Dialog open={isBatchesOpen} onOpenChange={setIsBatchesOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader><DialogTitle>Batch History: {currentMed?.name}</DialogTitle></DialogHeader>
                    <p className="text-sm text-neutral-500">Batches are sorted by expiry date (FEFO order). Oldest expiry first.</p>
                    <div className="border rounded-md overflow-hidden mt-4">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-neutral-50 text-neutral-500 font-semibold border-b">
                                <tr>
                                    <th className="p-3">Batch #</th>
                                    <th className="p-3">Expiry Date</th>
                                    <th className="p-3">Days Until</th>
                                    <th className="p-3">Qty (Initial)</th>
                                    <th className="p-3">Qty (Current)</th>
                                    <th className="p-3">Prices</th>
                                    <th className="p-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {batches.map(b => {
                                    const expiryDate = new Date(b.expiry_date);
                                    const today = new Date();
                                    const daysUntil = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                    const isExpired = daysUntil < 0;
                                    const isExpiringSoon = daysUntil >= 0 && daysUntil < 30;
                                    const isExpiringLater = daysUntil >= 30 && daysUntil < 90;

                                    return (
                                        <tr key={b.id} className={`hover:bg-neutral-50 ${isExpired ? 'bg-red-50' : isExpiringSoon ? 'bg-amber-50' : ''}`}>
                                            <td className="p-3 font-medium">{b.batch_number}</td>
                                            <td className={`p-3 ${isExpired ? 'text-red-700 font-bold' : isExpiringSoon ? 'text-amber-700' : ''}`}>
                                                {expiryDate.toLocaleDateString()}
                                            </td>
                                            <td className={`p-3 font-mono ${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-amber-600' : 'text-neutral-600'}`}>
                                                {isExpired ? `EXPIRED (${Math.abs(daysUntil)}d ago)` : `${daysUntil} days`}
                                            </td>
                                            <td className="p-3 text-neutral-500">{b.quantity_initial}</td>
                                            <td className="p-3 font-bold">{b.quantity_current}</td>
                                            <td className="p-3 text-xs">
                                                <div>Buy: {formatLKR(b.buying_price)}</div>
                                                <div>Sell: {formatLKR(b.selling_price)}</div>
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded text-xs border ${b.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                    b.status === 'EXPIRED' ? 'bg-red-50 text-red-700 border-red-200' :
                                                        'bg-neutral-100 text-neutral-500 border-neutral-200'
                                                    }`}>{b.status}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {batches.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-neutral-400">No batches found</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog - No Stock Editing */}
            <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) resetForm(); }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>Edit Medicine Details</DialogTitle></DialogHeader>
                    <p className="text-sm text-neutral-500">Note: Stock and prices are managed through batches.</p>
                    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                        <div className="space-y-2"><Label>Brand Name *</Label><Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Generic Name</Label><Input value={formData.generic_name} onChange={e => setFormData({ ...formData, generic_name: e.target.value })} placeholder="e.g., Paracetamol" /></div>
                            <div className="space-y-2"><Label>Manufacturer</Label><Input value={formData.manufacturer} onChange={e => setFormData({ ...formData, manufacturer: e.target.value })} placeholder="e.g., GSK" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Category</Label><Input value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} placeholder="e.g., Antibiotic" /></div>
                            <div className="space-y-2"><Label>Location</Label><Input value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder="Shelf A1" /></div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2"><Label>Unit *</Label><Input required value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} placeholder="tablets" /></div>
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
                            <div className="space-y-2"><Label>Strength</Label><Input value={formData.strength} onChange={e => setFormData({ ...formData, strength: e.target.value })} placeholder="500mg" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Selling Price per Unit (LKR) *</Label>
                                <Input type="number" step="0.01" required value={formData.price_per_unit} onChange={e => setFormData({ ...formData, price_per_unit: e.target.value })} placeholder="e.g., 15.50" />
                                <p className="text-xs text-neutral-500">Standard price per unit</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Min Stock Level *</Label>
                                <Input type="number" required value={formData.min_stock_level} onChange={e => setFormData({ ...formData, min_stock_level: e.target.value })} />
                            </div>
                        </div>
                        <Button type="submit" className="w-full bg-blue-600">Update Medicine</Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Restock Dialog (Add Batch) */}
            <Dialog open={isRestockOpen} onOpenChange={(open) => { setIsRestockOpen(open); if (!open) resetRestockForm(); }}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Add New Batch</DialogTitle></DialogHeader>
                    {currentMed && (
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                            <p className="text-sm"><strong className="text-blue-900">{currentMed.name}</strong></p>
                            {currentMed.generic_name && <p className="text-xs text-blue-700">{currentMed.generic_name}</p>}
                        </div>
                    )}
                    <form onSubmit={handleRestockSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Batch Number</Label>
                            <Input placeholder="Auto-generated if empty" value={restockForm.batch_number} onChange={e => setRestockForm({ ...restockForm, batch_number: e.target.value })} />
                            <p className="text-xs text-neutral-500">Leave empty to auto-generate</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Quantity *</Label>
                                <Input type="number" required value={restockForm.quantity} onChange={e => setRestockForm({ ...restockForm, quantity: e.target.value })} placeholder="100" />
                            </div>
                            <div className="space-y-2">
                                <Label>Expiry Date *</Label>
                                <Input type="date" required value={restockForm.expiry_date} onChange={e => setRestockForm({ ...restockForm, expiry_date: e.target.value })} />
                                <p className="text-xs text-neutral-500">Must be a future date</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Buying Price per Unit (LKR)</Label>
                                <Input type="number" step="0.01" value={restockForm.buying_price} onChange={e => setRestockForm({ ...restockForm, buying_price: e.target.value })} placeholder="e.g., 10.00" />
                                <p className="text-xs text-neutral-500">Cost price per single unit</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Selling Price per Unit (LKR) *</Label>
                                <Input type="number" step="0.01" required value={restockForm.selling_price} onChange={e => setRestockForm({ ...restockForm, selling_price: e.target.value })} placeholder={currentMed?.price_per_unit || '0.00'} />
                                <p className="text-xs text-neutral-500">Selling price per single unit</p>
                            </div>
                        </div>
                        <div className="bg-emerald-50 p-3 rounded border border-emerald-200 text-xs">
                            <div className="font-semibold text-emerald-900 mb-1">💡 Pricing Info</div>
                            <ul className="text-emerald-800 space-y-1 ml-4 list-disc">
                                <li>All prices are <strong>per unit</strong>, not per batch</li>
                                <li>Total batch cost = Buying Price × Quantity</li>
                                <li>Selling price can vary between batches</li>
                            </ul>
                        </div>
                        <Button type="submit" className="w-full bg-emerald-600">Add Batch to Inventory</Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
