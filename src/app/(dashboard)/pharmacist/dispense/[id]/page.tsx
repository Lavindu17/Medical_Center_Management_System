'use client';

import { useState, useEffect, use } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    ArrowLeft,
    CheckCircle,
    PackageCheck,
    RefreshCw,
    MapPin,
    Factory,
    Clock,
    AlertCircle,
    Calendar,
    Stethoscope,
    Sun,
    Moon,
    Sunrise,
    Sunset,
    AlertTriangle,
    XCircle,
    Layers,
    Zap,
    ChevronDown
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatLKR } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ─── FEFO Batch Modal ───────────────────────────────────────────────────────
function BatchModal({ item, onClose, onConfirm, prescriptionId, isProcessing }: {
    item: any;
    onClose: () => void;
    onConfirm: (qty: number) => Promise<void>;
    prescriptionId: string;
    isProcessing: boolean;
}) {
    const remaining = item.prescribed_quantity - (item.dispensed_quantity || 0);
    const batches: any[] = item.batches || [];

    // allocations keyed by batch_id
    const [allocations, setAllocations] = useState<Record<number, number>>({});

    const totalAllocated = Object.values(allocations).reduce((s, v) => s + (v || 0), 0);
    const isComplete = totalAllocated === remaining;

    const nonExpiredBatches = batches.filter(b => b.days_until_expiry >= 0);
    const totalNonExpiredStock = nonExpiredBatches.reduce((s, b) => s + b.quantity_current, 0);
    const canFulfill = totalNonExpiredStock >= remaining;

    // Auto-fill FEFO
    const autoFill = () => {
        const newAlloc: Record<number, number> = {};
        let need = remaining;
        for (const b of batches) {
            if (need <= 0) break;
            if (b.days_until_expiry < 0) continue;
            const take = Math.min(need, b.quantity_current);
            newAlloc[b.batch_id] = take;
            need -= take;
        }
        setAllocations(newAlloc);
    };

    const handleChange = (batchId: number, value: string, maxQty: number) => {
        const v = Math.max(0, Math.min(parseInt(value) || 0, maxQty));
        setAllocations(prev => ({ ...prev, [batchId]: v }));
    };

    // FEFO enforcement: can only allocate to batch N if all prior non-expired batches are fully used
    const canEditBatch = (index: number): boolean => {
        const nonExpiredUpTo = batches
            .slice(0, index)
            .filter(b => b.days_until_expiry >= 0);
        return nonExpiredUpTo.every(b => (allocations[b.batch_id] || 0) >= b.quantity_current || (allocations[b.batch_id] || 0) + (remaining - totalAllocated) <= 0);
    };

    // Simpler FEFO lock: a batch is locked if a PRIOR non-expired batch still has unallocated stock
    const isBatchLocked = (batchIndex: number): boolean => {
        for (let i = 0; i < batchIndex; i++) {
            const b = batches[i];
            if (b.days_until_expiry < 0) continue; // skip expired prior batches
            const allocated = allocations[b.batch_id] || 0;
            if (allocated < b.quantity_current) return true; // prior batch not fully used
        }
        return false;
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <div className="flex items-center justify-between pr-6">
                        <DialogTitle className="flex items-center gap-2">
                            <Layers className="h-5 w-5 text-emerald-600" />
                            FEFO Batch Selection — {item.medicine_name}
                        </DialogTitle>
                        {item.location && (
                            <Badge variant="outline" className="flex items-center gap-1.5 px-2 py-1 h-7 border-amber-200 bg-amber-50 text-amber-700 font-bold">
                                <MapPin className="h-3.5 w-3.5" />
                                {item.location}
                            </Badge>
                        )}
                    </div>
                </DialogHeader>

                <div className="text-sm text-neutral-500 mb-2">
                    Batches are ordered by earliest expiry first. You must use older batches before newer ones.
                </div>

                {!canFulfill && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm font-medium mb-2">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        Insufficient non-expired stock to fulfill {remaining} {item.unit}. Available: {totalNonExpiredStock}.
                    </div>
                )}

                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-neutral-50 border-b text-neutral-500 font-semibold text-xs uppercase">
                            <tr>
                                <th className="p-3 text-left">Batch #</th>
                                <th className="p-3 text-left">Expiry</th>
                                <th className="p-3 text-center">Available</th>
                                <th className="p-3 text-center">Allocate</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {batches.map((batch, idx) => {
                                const isExpired = batch.days_until_expiry < 0;
                                const locked = !isExpired && isBatchLocked(idx);
                                const allocated = allocations[batch.batch_id] || 0;

                                return (
                                    <tr key={batch.batch_id} className={`${isExpired ? 'bg-red-50/60' : locked ? 'bg-neutral-50' : 'bg-white'}`}>
                                        <td className="p-3 font-mono font-medium text-neutral-700">
                                            {batch.batch_number}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex flex-col gap-0.5">
                                                <span className={`font-medium text-xs ${isExpired ? 'text-red-700' : batch.days_until_expiry <= 30 ? 'text-amber-700' : 'text-neutral-700'}`}>
                                                    {new Date(batch.expiry_date).toLocaleDateString()}
                                                </span>
                                                {isExpired ? (
                                                    <Badge className="bg-red-100 text-red-700 border-0 text-[10px] h-4 w-fit px-1.5">EXPIRED</Badge>
                                                ) : batch.days_until_expiry <= 30 ? (
                                                    <span className="text-[10px] text-amber-600 font-semibold">{batch.days_until_expiry}d left</span>
                                                ) : (
                                                    <span className="text-[10px] text-neutral-400">{batch.days_until_expiry}d left</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3 text-center font-bold text-neutral-800">
                                            {batch.quantity_current}
                                            <span className="text-xs font-normal text-neutral-400 ml-1">{item.unit}</span>
                                        </td>
                                        <td className="p-3 text-center">
                                            {isExpired ? (
                                                <span className="text-xs text-red-400 italic">Cannot dispense</span>
                                            ) : locked ? (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="flex items-center justify-center">
                                                                <Input
                                                                    type="number" min={0} max={batch.quantity_current}
                                                                    value={allocated}
                                                                    disabled
                                                                    className="w-16 h-8 text-center bg-neutral-100 text-neutral-400"
                                                                />
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Use earlier batch stock first (FEFO)</TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            ) : (
                                                <Input
                                                    type="number" min={0}
                                                    max={Math.min(batch.quantity_current, remaining - (totalAllocated - allocated))}
                                                    value={allocated}
                                                    onChange={e => handleChange(batch.batch_id, e.target.value, batch.quantity_current)}
                                                    className="w-16 h-8 text-center mx-auto"
                                                />
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Totals */}
                <div className="flex items-center justify-between px-1 py-2">
                    <div className="flex items-center gap-3">
                        <div className={`text-sm font-semibold ${isComplete ? 'text-emerald-700' : 'text-neutral-500'}`}>
                            Allocated: <span className={`text-lg font-bold ${isComplete ? 'text-emerald-700' : totalAllocated > remaining ? 'text-red-600' : 'text-neutral-800'}`}>{totalAllocated}</span>
                            <span className="text-neutral-400 font-normal"> / {remaining} needed</span>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={autoFill}
                        className="flex items-center gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    >
                        <Zap className="h-3.5 w-3.5" />
                        Auto-fill FEFO
                    </Button>
                </div>

                <div className="flex gap-3 justify-end mt-1">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        className="bg-emerald-600 hover:bg-emerald-700"
                        disabled={!isComplete || isProcessing}
                        onClick={() => onConfirm(totalAllocated)}
                    >
                        {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <PackageCheck className="h-4 w-4 mr-2" />}
                        Confirm Dispense ({totalAllocated} {item.unit})
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Reject Modal ───────────────────────────────────────────────────────────
function RejectModal({ item, onClose, onConfirm, isProcessing }: {
    item: any;
    onClose: () => void;
    onConfirm: (reason: string) => Promise<void>;
    isProcessing: boolean;
}) {
    const [reason, setReason] = useState('');

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-700">
                        <XCircle className="h-5 w-5" />
                        Reject Dispensing
                    </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-neutral-600">
                    Select the reason for rejecting <span className="font-semibold">{item.medicine_name}</span>:
                </p>
                <div className="space-y-2 mt-1">
                    {[
                        { value: 'OUT_OF_STOCK', label: 'Out of Stock', desc: 'No valid stock available to fulfill this item' },
                        { value: 'PATIENT_REJECTED', label: 'Patient Rejected', desc: 'Patient declined this medicine' }
                    ].map(opt => (
                        <label
                            key={opt.value}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${reason === opt.value ? 'border-red-400 bg-red-50' : 'border-neutral-200 hover:border-neutral-300'}`}
                        >
                            <input
                                type="radio" name="reason" value={opt.value}
                                checked={reason === opt.value}
                                onChange={e => setReason(e.target.value)}
                                className="mt-0.5 accent-red-600"
                            />
                            <div>
                                <div className="font-semibold text-sm text-neutral-800">{opt.label}</div>
                                <div className="text-xs text-neutral-500">{opt.desc}</div>
                            </div>
                        </label>
                    ))}
                </div>
                <div className="flex gap-3 justify-end mt-2">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        className="bg-red-600 hover:bg-red-700"
                        disabled={!reason || isProcessing}
                        onClick={() => onConfirm(reason)}
                    >
                        {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                        Reject Item
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function DispensePage(props: { params: Promise<{ id: string }> }) {
    const params = use(props.params);
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<number | null>(null);

    const [batchModal, setBatchModal] = useState<any | null>(null);
    const [rejectModal, setRejectModal] = useState<any | null>(null);

    const fetchData = () => {
        setLoading(true);
        fetch(`/api/pharmacist/dispense/${params.id}`)
            .then(res => res.json())
            .then(resData => {
                if (resData.error) {
                    alert(resData.error);
                    router.push('/pharmacist/prescriptions');
                    return;
                }
                setData(resData);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, [params.id]);

    const handleDispense = async (item: any, qty: number) => {
        setProcessingId(item.item_id);
        try {
            const res = await fetch(`/api/pharmacist/dispense/${params.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'DISPENSE',
                    item_id: item.item_id,
                    medicine_id: item.medicine_id,
                    quantity_to_dispense: qty
                })
            });
            if (res.ok) {
                setBatchModal(null);
                fetchData();
            } else {
                const err = await res.json();
                alert('Error: ' + err.error);
            }
        } catch (e) {
            alert('Failed to process');
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (item: any, reason: string) => {
        setProcessingId(item.item_id);
        try {
            const res = await fetch(`/api/pharmacist/dispense/${params.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'REJECT',
                    item_id: item.item_id,
                    reason
                })
            });
            if (res.ok) {
                setRejectModal(null);
                fetchData();
            } else {
                const err = await res.json();
                alert('Error: ' + err.error);
            }
        } catch (e) {
            alert('Failed to process');
        } finally {
            setProcessingId(null);
        }
    };

    const parseFrequency = (freq: string) => {
        if (!freq) return null;
        const parts = freq.split('-').map(p => p.trim());
        const isNumberLike = (s: string) => /^\d+(\.\d+)?$|^\d+\/\d+$|^\d+\s+\d+\/\d+$/.test(s);
        const validParts = parts.every(p => isNumberLike(p));
        if (validParts && (parts.length === 3 || parts.length === 4)) {
            const elements = [];
            const isPositive = (s: string) => {
                if (s === '0') return false;
                if (s.includes('/')) return true;
                return parseFloat(s) > 0;
            };
            if (parts.length === 3) {
                if (isPositive(parts[0])) elements.push({ label: 'Morn', qty: parts[0], color: 'bg-amber-100 text-amber-800 border-amber-200', icon: <Sunrise className="h-3 w-3" /> });
                if (isPositive(parts[1])) elements.push({ label: 'Noon', qty: parts[1], color: 'bg-orange-100 text-orange-800 border-orange-200', icon: <Sun className="h-3 w-3" /> });
                if (isPositive(parts[2])) elements.push({ label: 'Night', qty: parts[2], color: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: <Moon className="h-3 w-3" /> });
            } else {
                if (isPositive(parts[0])) elements.push({ label: 'Morn', qty: parts[0], color: 'bg-amber-100 text-amber-800 border-amber-200', icon: <Sunrise className="h-3 w-3" /> });
                if (isPositive(parts[1])) elements.push({ label: 'Noon', qty: parts[1], color: 'bg-orange-100 text-orange-800 border-orange-200', icon: <Sun className="h-3 w-3" /> });
                if (isPositive(parts[2])) elements.push({ label: 'Eve', qty: parts[2], color: 'bg-rose-100 text-rose-800 border-rose-200', icon: <Sunset className="h-3 w-3" /> });
                if (isPositive(parts[3])) elements.push({ label: 'Night', qty: parts[3], color: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: <Moon className="h-3 w-3" /> });
            }
            if (elements.length > 0) {
                return (
                    <div className="flex items-center gap-2">
                        {elements.map((el, idx) => (
                            <Badge key={idx} variant="outline" className={`flex items-center gap-1.5 px-2 py-0.5 h-6 text-xs font-semibold ${el.color} border`}>
                                {el.icon}
                                <span>{el.qty} {el.label}</span>
                            </Badge>
                        ))}
                    </div>
                );
            }
        }
        return (
            <Badge variant="secondary" className="bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border-neutral-200 flex items-center gap-1">
                <Clock className="h-3 w-3 opacity-50" /> {freq}
            </Badge>
        );
    };

    if (loading && !data) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="flex items-center gap-3 text-emerald-700 bg-white px-6 py-4 rounded-full shadow-sm">
                <RefreshCw className="animate-spin h-5 w-5" />
                <span className="font-medium">Loading details...</span>
            </div>
        </div>
    );

    if (!data) return <div className="p-8">Prescription not found</div>;

    const { prescription, items } = data;
    const completedCount = items.filter((i: any) => i.status === 'DISPENSED' || i.status === 'REJECTED').length;
    const dispensedCount = items.filter((i: any) => i.status === 'DISPENSED').length;
    const totalCount = items.length;
    const progress = Math.round((completedCount / totalCount) * 100);
    const allDone = completedCount === totalCount;

    return (
        <div className="min-h-screen bg-gray-50/50 pb-20">
            {/* Modals */}
            {batchModal && (
                <BatchModal
                    item={batchModal}
                    onClose={() => setBatchModal(null)}
                    onConfirm={(qty) => handleDispense(batchModal, qty)}
                    prescriptionId={params.id}
                    isProcessing={processingId === batchModal.item_id}
                />
            )}
            {rejectModal && (
                <RejectModal
                    item={rejectModal}
                    onClose={() => setRejectModal(null)}
                    onConfirm={(reason) => handleReject(rejectModal, reason)}
                    isProcessing={processingId === rejectModal.item_id}
                />
            )}

            {/* Top Bar */}
            <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="sm" className="-ml-2 text-neutral-500 hover:text-neutral-900" onClick={() => router.back()}>
                                <ArrowLeft className="h-4 w-4 mr-1" /> Queue
                            </Button>
                            <div className="h-4 w-px bg-neutral-200 hidden md:block"></div>
                            <h1 className="font-bold text-lg text-neutral-900">Dispensing Room</h1>
                        </div>
                        <div className="flex items-center gap-6 flex-1 justify-end">
                            <div className="flex items-center gap-3 flex-1 max-w-xs">
                                <div className="flex-1">
                                    <div className="flex justify-between text-xs mb-1.5">
                                        <span className="font-medium text-neutral-600">Progress</span>
                                        <span className="font-bold text-emerald-700">{dispensedCount} dispensed, {completedCount - dispensedCount} rejected / {totalCount} items</span>
                                    </div>
                                    <Progress value={progress} className="h-2 bg-neutral-100 [&>div]:bg-emerald-500" />
                                </div>
                            </div>
                            {allDone && (
                                <Button className="bg-emerald-600 hover:bg-emerald-700 shadow-md" onClick={() => router.push('/pharmacist/prescriptions')}>
                                    <CheckCircle className="mr-2 h-4 w-4" /> Finish
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

                {/* Patient Summary Card */}
                <Card className="border shadow-sm bg-white overflow-hidden p-0">
                    <div className="flex flex-col md:flex-row md:items-start p-5 gap-6">
                        <div className="flex-1 flex items-start gap-4">
                            <div className="h-12 w-12 rounded-full bg-emerald-100 shrink-0 flex items-center justify-center text-emerald-700 font-bold text-xl">
                                {prescription.patient_name.charAt(0)}
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="text-xl font-bold text-neutral-900">{prescription.patient_name}</h2>
                                    <Badge variant="outline" className="text-xs font-normal h-5 border-neutral-300 text-neutral-500">#{prescription.patient_id}</Badge>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-neutral-500">
                                    {prescription.gender && <span>{prescription.gender}</span>}
                                    {prescription.date_of_birth && <span>• {new Date().getFullYear() - new Date(prescription.date_of_birth).getFullYear()} Years</span>}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1 text-sm border-l px-6 border-neutral-100 hidden md:flex">
                            <div className="flex items-center gap-2 text-neutral-700 font-medium">
                                <Stethoscope className="h-4 w-4 text-emerald-600" />
                                <span>Dr. {prescription.doctor_name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-neutral-500">
                                <Calendar className="h-4 w-4 text-neutral-400" />
                                <span>{new Date(prescription.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <div className="flex-1 max-w-sm border-l pl-6 border-neutral-100">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className={`h-4 w-4 ${prescription.allergies ? 'text-red-500' : 'text-neutral-400'}`} />
                                <span className="text-sm font-bold text-neutral-700 uppercase tracking-tight">Medical Alerts</span>
                            </div>
                            {prescription.allergies ? (
                                <div className="bg-red-50 border border-red-100 rounded-md p-2">
                                    <p className="text-xs font-semibold text-red-700 leading-relaxed">Allergies: {prescription.allergies}</p>
                                </div>
                            ) : (
                                <p className="text-sm text-neutral-400 italic">No known allergies</p>
                            )}
                        </div>
                    </div>
                </Card>

                {/* Medicine List */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2">
                        <h3 className="font-bold text-lg text-neutral-800 flex items-center gap-2">
                            Prescribed Medicines
                            <Badge variant="secondary" className="rounded-full px-2 text-neutral-500">{items.length}</Badge>
                        </h3>
                        <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading} className="text-neutral-500 hover:text-emerald-700 h-8">
                            <RefreshCw className={`h-3 w-3 mr-2 ${loading ? 'animate-spin' : ''}`} /> Sync Stock
                        </Button>
                    </div>

                    {items.map((item: any) => {
                        const isDispensed = item.status === 'DISPENSED';
                        const isRejected = item.status === 'REJECTED';
                        const isDone = isDispensed || isRejected;
                        const isPartial = item.status === 'PARTIALLY_COMPLETED';
                        const remaining = item.prescribed_quantity - (item.dispensed_quantity || 0);
                        const batches: any[] = item.batches || [];
                        const nonExpiredStock = batches.filter(b => b.days_until_expiry >= 0).reduce((s: number, b: any) => s + b.quantity_current, 0);
                        const hasExpiredBatches = batches.some(b => b.days_until_expiry < 0);
                        const isProcessing = processingId === item.item_id;

                        return (
                            <div key={item.item_id}
                                className={`group relative bg-white rounded-xl border transition-all duration-200 overflow-hidden ${isDispensed
                                    ? 'bg-emerald-50/40 border-emerald-100 shadow-sm'
                                    : isRejected
                                        ? 'bg-neutral-50 border-neutral-200 opacity-75'
                                        : 'hover:border-emerald-400 hover:shadow-md border-neutral-200 shadow-sm'
                                    }`}>

                                {/* Status Color Bar */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${isDispensed ? 'bg-emerald-500' : isRejected ? 'bg-neutral-400' : isPartial ? 'bg-amber-400' : 'bg-neutral-300 group-hover:bg-emerald-400'}`}></div>

                                <div className="p-4 pl-5">
                                    <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">

                                        {/* Left: Medicine Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                                                <h4 className={`text-lg font-bold truncate ${isDispensed ? 'text-emerald-900' : isRejected ? 'text-neutral-500 line-through' : 'text-neutral-900'}`}>
                                                    {item.medicine_name}
                                                </h4>
                                                {item.category && (
                                                    <Badge variant="secondary" className="bg-neutral-100 text-neutral-600 hover:bg-neutral-200 border-transparent text-[10px] h-5">
                                                        {item.category}
                                                    </Badge>
                                                )}
                                                {isDispensed && (
                                                    <Badge className="bg-emerald-100 text-emerald-700 border-transparent h-5 shadow-none px-1.5 gap-1">
                                                        <CheckCircle className="h-3 w-3" /> Dispensed
                                                    </Badge>
                                                )}
                                                {isPartial && (
                                                    <Badge className="bg-amber-100 text-amber-700 border-transparent h-5 shadow-none px-1.5">
                                                        Partial
                                                    </Badge>
                                                )}
                                                {isRejected && (
                                                    <Badge className="bg-neutral-200 text-neutral-600 border-transparent h-5 shadow-none px-1.5 gap-1">
                                                        <XCircle className="h-3 w-3" />
                                                        {item.rejection_reason === 'OUT_OF_STOCK' ? 'Out of Stock' : 'Patient Rejected'}
                                                    </Badge>
                                                )}
                                                {hasExpiredBatches && !isDone && (
                                                    <Badge className="bg-red-100 text-red-600 border-0 text-[10px] h-5 gap-1">
                                                        <AlertTriangle className="h-3 w-3" /> Has expired batch
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-x-6 gap-y-2 flex-wrap text-sm text-neutral-600">
                                                <div className="flex items-center gap-2 pr-4 border-r border-neutral-100">
                                                    <span className="font-semibold text-neutral-900 text-lg mr-1">{item.dosage}</span>
                                                    {parseFrequency(item.frequency)}
                                                    <span className="text-neutral-400 ml-1">for {item.duration}</span>
                                                </div>
                                                {(item.location || item.manufacturer) && (
                                                    <div className="flex items-center gap-4 text-xs font-medium text-neutral-500">
                                                        {item.location && (
                                                            <div className="flex items-center gap-1.5" title="Location">
                                                                <MapPin className="h-3.5 w-3.5 text-amber-500" />
                                                                <span>{item.location}</span>
                                                            </div>
                                                        )}
                                                        {item.manufacturer && (
                                                            <div className="flex items-center gap-1.5" title="Manufacturer">
                                                                <Factory className="h-3.5 w-3.5 text-purple-400" />
                                                                <span className="truncate max-w-[150px]">{item.manufacturer}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {item.generic_name && (
                                                <p className="text-xs text-neutral-400 mt-1.5 truncate">{item.generic_name}</p>
                                            )}
                                        </div>

                                        {/* Right: Quantities & Actions */}
                                        <div className="flex items-center gap-4 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 pl-0 md:pl-4 md:border-l border-neutral-100">

                                            {/* Qty Stats */}
                                            <div className="flex flex-col gap-1 text-sm min-w-[110px]">
                                                <div className="flex justify-between">
                                                    <span className="text-neutral-500 text-[10px] uppercase font-semibold">PRESCRIBED:</span>
                                                    <span className="font-bold text-neutral-900 text-xs">{item.prescribed_quantity}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-neutral-500 text-[10px] uppercase font-semibold">DISPENSED:</span>
                                                    <span className="font-bold text-emerald-600 text-xs">{item.dispensed_quantity || 0}</span>
                                                </div>
                                                <div className="flex justify-between border-t mt-0.5 pt-0.5">
                                                    <span className="text-neutral-400 text-[10px] uppercase font-semibold">IN STOCK:</span>
                                                    <span className={`font-medium text-xs ${nonExpiredStock >= remaining ? 'text-neutral-600' : 'text-red-500'}`}>{nonExpiredStock} valid</span>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex flex-col gap-2 w-full md:w-auto">
                                                {isDone ? (
                                                    <div className="flex h-9 w-9 bg-emerald-100 rounded-full items-center justify-center text-emerald-600 shadow-sm mx-auto">
                                                        {isDispensed ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5 text-neutral-400" />}
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-2">
                                                        <Button
                                                            onClick={() => setBatchModal(item)}
                                                            disabled={isProcessing || loading || nonExpiredStock === 0}
                                                            size="sm"
                                                            className="h-10 px-3 font-medium bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                                                        >
                                                            {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4 mr-1.5" />}
                                                            Dispense
                                                        </Button>
                                                        <Button
                                                            onClick={() => setRejectModal(item)}
                                                            disabled={isProcessing || loading}
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-10 px-3 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400"
                                                        >
                                                            <XCircle className="h-4 w-4 mr-1" />
                                                            Reject
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {items.length === 0 && (
                        <div className="text-center py-12 bg-white rounded-xl border border-dashed text-neutral-400">
                            <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
                            <p>No medicines in this prescription.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
