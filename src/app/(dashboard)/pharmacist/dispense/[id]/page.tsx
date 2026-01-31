
'use client';

import { useState, useEffect, use } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
    ArrowLeft,
    CheckCircle,
    PackageCheck,
    RefreshCw,
    MapPin,
    Factory,
    Tag,
    Clock,
    AlertCircle,
    User,
    Calendar,
    Stethoscope,
    Sun,
    Moon,
    Sunrise,
    Sunset,
    AlertTriangle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatLKR } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function DispensePage(props: { params: Promise<{ id: string }> }) {
    const params = use(props.params);
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<number | null>(null);

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

    useEffect(() => {
        fetchData();
    }, [params.id, router]);

    const handleDispenseItem = async (item: any) => {
        if (!confirm(`Confirm dispensing ${item.prescribed_quantity} ${item.unit} of ${item.medicine_name}?`)) return;

        setProcessingId(item.item_id);
        try {
            const res = await fetch(`/api/pharmacist/dispense/${params.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    item_id: item.item_id,
                    medicine_id: item.medicine_id,
                    quantity_to_dispense: item.prescribed_quantity
                })
            });

            if (res.ok) {
                fetchData();
            } else {
                const err = await res.json();
                alert('Error: ' + err.error);
            }
        } catch (e) {
            console.error(e);
            alert('Failed to process');
        } finally {
            setProcessingId(null);
        }
    };

    const parseFrequency = (freq: string) => {
        if (!freq) return null;

        // Split by hyphen and trim
        // E.g. "1 - 1/2 - 1 - 1/2" -> ["1", "1/2", "1", "1/2"]
        const parts = freq.split('-').map(p => p.trim());

        // Check if all parts are number-like (int, decimal, or fraction)
        // Regex: 
        // ^\d+(\.\d+)?$  -> 1, 1.5
        // ^\d+\/\d+$     -> 1/2
        // ^\d+\s+\d+\/\d+$ -> 1 1/2 (mixed number)
        const isNumberLike = (s: string) => /^\d+(\.\d+)?$|^\d+\/\d+$|^\d+\s+\d+\/\d+$/.test(s);

        // We only process if we have 3 or 4 parts and they look like quantities
        const validParts = parts.every(p => isNumberLike(p));

        if (validParts && (parts.length === 3 || parts.length === 4)) {
            const elements = [];

            // Helper to parse quantity value for checking > 0
            // We treat "0" as 0, everything else as positive for display
            const isPositive = (s: string) => {
                if (s === '0') return false;
                if (s.includes('/')) return true; // Fractions (1/2) are > 0
                return parseFloat(s) > 0;
            };

            if (parts.length === 3) {
                // Morn - Noon - Night
                if (isPositive(parts[0])) elements.push({ label: 'Morn', qty: parts[0], color: 'bg-amber-100 text-amber-800 border-amber-200', icon: <Sunrise className="h-3 w-3" /> });
                if (isPositive(parts[1])) elements.push({ label: 'Noon', qty: parts[1], color: 'bg-orange-100 text-orange-800 border-orange-200', icon: <Sun className="h-3 w-3" /> });
                if (isPositive(parts[2])) elements.push({ label: 'Night', qty: parts[2], color: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: <Moon className="h-3 w-3" /> });
            } else if (parts.length === 4) {
                // Morn - Noon - Eve - Night
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
    const dispensedCount = items.filter((i: any) => i.status === 'DISPENSED').length;
    const totalCount = items.length;
    const progress = Math.round((dispensedCount / totalCount) * 100);
    const allDispensed = dispensedCount === totalCount;

    return (
        <div className="min-h-screen bg-gray-50/50 pb-20">
            {/* Top Bar: Progress & Status */}
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
                                        <span className="font-bold text-emerald-700">{dispensedCount} / {totalCount} Item{totalCount !== 1 ? 's' : ''}</span>
                                    </div>
                                    <Progress value={progress} className="h-2 bg-neutral-100 [&>div]:bg-emerald-500" />
                                </div>
                            </div>

                            {allDispensed && (
                                <Button className="bg-emerald-600 hover:bg-emerald-700 shadow-md" onClick={() => router.push('/pharmacist/prescriptions')}>
                                    <CheckCircle className="mr-2 h-4 w-4" /> Finish
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

                {/* Patient Summary Card (Full Width) */}
                <Card className="border shadow-sm bg-white overflow-hidden p-0">
                    <div className="flex flex-col md:flex-row md:items-start p-5 gap-6">
                        {/* Patient Core Info */}
                        <div className="flex-1 flex items-start gap-4">
                            <div className="h-12 w-12 rounded-full bg-emerald-100 shrink-0 flex items-center justify-center text-emerald-700 font-bold text-xl">
                                {prescription.patient_name.charAt(0)}
                            </div>
                            <div className=" space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="text-xl font-bold text-neutral-900">{prescription.patient_name}</h2>
                                    <Badge variant="outline" className="text-xs font-normal h-5 border-neutral-300 text-neutral-500">
                                        #{prescription.patient_id}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-neutral-500">
                                    {prescription.gender && <span>{prescription.gender}</span>}
                                    {prescription.date_of_birth && <span>• {new Date().getFullYear() - new Date(prescription.date_of_birth).getFullYear()} Years</span>}
                                </div>
                            </div>
                        </div>

                        {/* Middle: Doctor & Date */}
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

                        {/* Right: Allergies Warning */}
                        <div className="flex-1 max-w-sm border-l pl-6 border-neutral-100">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className={`h-4 w-4 ${prescription.allergies ? 'text-red-500' : 'text-neutral-400'}`} />
                                <span className="text-sm font-bold text-neutral-700 uppercase tracking-tight">Medical Alerts</span>
                            </div>
                            {prescription.allergies ? (
                                <div className="bg-red-50 border border-red-100 rounded-md p-2">
                                    <p className="text-xs font-semibold text-red-700 leading-relaxed">
                                        Allergies: {prescription.allergies}
                                    </p>
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
                        const stockAvailable = item.current_stock >= item.prescribed_quantity;
                        const isProcessing = processingId === item.item_id;

                        return (
                            <div key={item.item_id}
                                className={`group relative bg-white rounded-xl border transition-all duration-200 overflow-hidden ${isDispensed
                                    ? 'bg-emerald-50/40 border-emerald-100 shadow-sm'
                                    : 'hover:border-emerald-400 hover:shadow-md border-neutral-200 shadow-sm'
                                    }`}>

                                {/* Status Indicator Color Bar */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${isDispensed ? 'bg-emerald-500' : 'bg-neutral-300 group-hover:bg-emerald-400'}`}></div>

                                <div className="p-4 pl-5">
                                    <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">

                                        {/* Left Side: Medicine Info */}
                                        <div className="flex-1 min-w-0">
                                            {/* Row 1: Name, Badges */}
                                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                                                <h4 className={`text-lg font-bold truncate ${isDispensed ? 'text-emerald-900' : 'text-neutral-900'}`}>
                                                    {item.medicine_name}
                                                </h4>
                                                {item.category && (
                                                    <Badge variant="secondary" className="bg-neutral-100 text-neutral-600 hover:bg-neutral-200 border-transparent text-[10px] h-5">
                                                        {item.category}
                                                    </Badge>
                                                )}
                                                {isDispensed && (
                                                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-transparent h-5 shadow-none px-1.5 gap-1">
                                                        <CheckCircle className="h-3 w-3" /> Dispensed
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Row 2: Details Compact */}
                                            <div className="flex items-center gap-x-6 gap-y-2 flex-wrap text-sm text-neutral-600">

                                                {/* Frequency / Dosage */}
                                                <div className="flex items-center gap-2 pr-4 border-r border-neutral-100">
                                                    <span className="font-semibold text-neutral-900 text-lg mr-1">{item.dosage}</span>
                                                    {parseFrequency(item.frequency)}
                                                    <span className="text-neutral-400 ml-1">for {item.duration}</span>
                                                </div>

                                                {/* Logistics Group */}
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

                                                <div className="flex items-center gap-1.5 ml-auto md:ml-0">
                                                    <span className="font-mono font-medium text-neutral-800 bg-neutral-50 px-1.5 py-0.5 rounded text-xs">{formatLKR(item.selling_price * item.prescribed_quantity)}</span>
                                                </div>
                                            </div>

                                            {item.generic_name && (
                                                <p className="text-xs text-neutral-400 mt-1.5 truncate">{item.generic_name}</p>
                                            )}
                                        </div>

                                        {/* Right Side: Action & Stock */}
                                        <div className="flex items-center gap-4 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 pl-0 md:pl-4 md:border-l border-neutral-100">

                                            {/* Stock Counter */}
                                            <div className="flex flex-row md:flex-col justify-between items-center gap-x-6 gap-y-0.5 w-full md:w-auto min-w-[100px]">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="text-neutral-500 text-xs uppercase font-semibold w-10 text-right">Need</span>
                                                    <span className="font-bold text-neutral-900">{item.prescribed_quantity} <span className="text-xs font-normal text-neutral-400">{item.unit}</span></span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="text-neutral-400 text-xs uppercase font-semibold w-10 text-right">Have</span>
                                                    <span className={`font-medium ${stockAvailable ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {item.current_stock}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Action Button */}
                                            <div className="w-full md:w-auto">
                                                {isDispensed ? (
                                                    <div className="hidden md:flex h-9 w-9 bg-emerald-100 rounded-full items-center justify-center text-emerald-600">
                                                        <CheckCircle className="h-5 w-5" />
                                                    </div>
                                                ) : (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    onClick={() => handleDispenseItem(item)}
                                                                    disabled={!stockAvailable || isProcessing || loading}
                                                                    size="sm"
                                                                    className={`w-full md:w-auto h-10 px-4 font-medium shadow-sm transition-all ${stockAvailable
                                                                        ? 'bg-emerald-600 hover:bg-emerald-700'
                                                                        : 'bg-red-500 hover:bg-red-600'
                                                                        }`}
                                                                >
                                                                    {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4 mr-1.5" />}
                                                                    {stockAvailable ? 'Dispense' : 'Restock'}
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                {!stockAvailable ? 'Insufficient inventory to dispense' : 'Click to dispense and update stock'}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
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
