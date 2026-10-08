'use client';
import { PageHeader } from '@/components/ui/page-header';
import { formatDate } from '@/lib/dates';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatLKR } from '@/lib/utils';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, User, Calendar, Clock, CreditCard, Pill, TestTube2, FileText } from 'lucide-react';

export default function AppointmentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!params.id) return;
        
        fetch(`/api/appointments/${params.id}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to load appointment details');
                return res.json();
            })
            .then(data => {
                setData(data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError(err.message);
                setIsLoading(false);
            });
    }, [params.id]);

    if (isLoading) {
        return <div className="max-w-5xl mx-auto animate-pulse flex flex-col gap-4">
            <div className="h-8 bg-neutral-200 rounded w-1/4"></div>
            <div className="h-32 bg-neutral-100 rounded w-full"></div>
            <div className="h-64 bg-neutral-100 rounded w-full"></div>
        </div>;
    }

    if (error || !data) {
        return (
            <div className="max-w-5xl mx-auto flex flex-col items-center justify-center text-center">
                <FileText className="h-16 w-16 text-neutral-300 mb-4" />
                <h2 className="text-xl font-bold mb-2">Error Loading Details</h2>
                <p className="text-neutral-500 mb-6">{error || 'Appointment not found'}</p>
                <Button onClick={() => router.back()}>Go Back</Button>
            </div>
        );
    }

    const { appointment, bill, prescription, labs } = data;

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-20">
            <PageHeader
                back={{ href: '/patient/appointments', label: 'My appointments' }}
                title={<span className="flex flex-wrap items-center gap-3">Appointment detail <StatusBadge status={appointment.status} /></span>}
                description={`Reference #${appointment.id}`}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Column - Core Info */}
                <div className="space-y-6 lg:col-span-2">
                    
                    {/* General Info Card */}
                    <Card>
                        <CardHeader className="bg-neutral-50/50 border-b pb-4">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5 text-emerald-600" />
                                Visit Overview
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <h2 className="text-sm font-semibold text-neutral-500 mb-1 flex items-center gap-2">
                                        <User className="h-4 w-4" /> Doctor
                                    </h2>
                                    <p className="font-medium text-lg">{appointment.doctorName}</p>
                                    <p className="text-sm text-neutral-500">{appointment.specialization}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <h2 className="text-sm font-semibold text-neutral-500 mb-1 flex items-center gap-2">
                                            <Calendar className="h-4 w-4" /> Date
                                        </h2>
                                        <p className="font-medium">{appointment.formatted_date}</p>
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-semibold text-neutral-500 mb-1 flex items-center gap-2">
                                            <Clock className="h-4 w-4" /> Time
                                        </h2>
                                        <p className="font-medium">{appointment.timeSlot}</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <h2 className="text-sm font-semibold text-neutral-500 mb-1">Reason for Visit</h2>
                                    <p className="bg-neutral-50 p-3 rounded-lg text-sm text-neutral-700 leading-relaxed border min-h-[60px]">
                                        {appointment.reason || 'No reason provided.'}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Vitals & Consultation Notes */}
                    <Card>
                        <CardHeader className="bg-neutral-50/50 border-b pb-4">
                            <CardTitle className="text-lg">Clinical Notes & Vitals</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                                <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100 text-center">
                                    <span className="text-xs font-semibold text-neutral-500 block">Weight</span>
                                    <span className="font-bold text-emerald-800">{appointment.weight ? `${appointment.weight} kg` : '--'}</span>
                                </div>
                                <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100 text-center">
                                    <span className="text-xs font-semibold text-neutral-500 block">Blood Pressure</span>
                                    <span className="font-bold text-emerald-800">{appointment.blood_pressure || '--/--'}</span>
                                </div>
                                <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100 text-center">
                                    <span className="text-xs font-semibold text-neutral-500 block">Temp</span>
                                    <span className="font-bold text-emerald-800">{appointment.temperature ? `${appointment.temperature}°C` : '--'}</span>
                                </div>
                                <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100 text-center">
                                    <span className="text-xs font-semibold text-neutral-500 block">Pulse</span>
                                    <span className="font-bold text-emerald-800">{appointment.pulse ? `${appointment.pulse} bpm` : '--'}</span>
                                </div>
                            </div>
                            
                            <div>
                                <h2 className="text-sm font-semibold text-neutral-500 mb-2">Doctor's Note</h2>
                                <div className="bg-neutral-50 p-4 rounded-lg text-sm text-neutral-700 whitespace-pre-wrap border min-h-[100px]">
                                    {appointment.notes || 'No consultation notes recorded yet.'}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Lab Results */}
                    <Card>
                        <CardHeader className="bg-neutral-50/50 border-b pb-4">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <TestTube2 className="h-5 w-5 text-indigo-600" />
                                Laboratory Tests
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {!labs || labs.length === 0 ? (
                                <p className="text-sm text-neutral-500 italic text-center py-4">No lab tests requested during this visit.</p>
                            ) : (
                                <div className="space-y-3">
                                    {labs.map((lab: any) => (
                                        <div key={lab.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg hover:bg-neutral-50 transition-colors">
                                            <div>
                                                <p className="font-semibold text-sm">{lab.testName}</p>
                                                <p className="text-xs text-neutral-500 mt-1">{formatDate(lab.requested_at)}</p>
                                            </div>
                                            <div className="flex items-center gap-3 mt-3 sm:mt-0">
                                                <StatusBadge status={lab.status} kind="lab" size="sm" />
                                                {lab.result_url && (
                                                    <Button size="sm" variant="outline" asChild className="h-8">
                                                        <a href={lab.result_url} target="_blank" rel="noopener noreferrer">View File</a>
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column - Prescription & Billing */}
                <div className="space-y-6">
                    
                    {/* Prescription */}
                    <Card>
                        <CardHeader className="bg-neutral-50/50 border-b pb-4">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Pill className="h-5 w-5 text-rose-500" />
                                Prescription
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {!prescription || !prescription.items || prescription.items.length === 0 ? (
                                <p className="text-sm text-neutral-500 italic text-center py-4">No medications prescribed.</p>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs text-neutral-500 uppercase font-semibold">Status</span>
                                        <StatusBadge status={prescription.prescriptionStatus} kind="prescription" size="sm" />
                                    </div>
                                    <div className="space-y-3">
                                        {prescription.items.map((item: any) => (
                                            <div key={item.id} className="border-b last:border-0 pb-3 last:pb-0">
                                                <div className="flex justify-between items-start mb-1">
                                                    <p className="font-semibold text-sm">{item.medicineName}</p>
                                                    <Badge variant="secondary" className="text-[10px] h-5">{item.status}</Badge>
                                                </div>
                                                <div className="text-xs text-neutral-600 space-y-1">
                                                    <p><span className="font-medium text-neutral-400 block w-16 inline-block">Dose:</span> {item.dosage} ({item.frequency})</p>
                                                    <p><span className="font-medium text-neutral-400 block w-16 inline-block">Duration:</span> {item.duration}</p>
                                                    <p><span className="font-medium text-neutral-400 block w-16 inline-block">Dispense:</span> {item.quantity} units</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Billing Summary */}
                    <Card className="border-neutral-200 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-amber-500/80"></div>
                        <CardHeader className="bg-neutral-50/50 border-b pb-4">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <CreditCard className="h-5 w-5 text-amber-600" />
                                Invoice Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {!bill ? (
                                <p className="text-sm text-neutral-500 italic text-center py-4 border border-dashed rounded-lg bg-neutral-50">Invoice not yet generated. Your bill will appear once the doctor finalizes your consultation.</p>
                            ) : (
                                <div className="space-y-1">
                                    {/* Doctor Consultation */}
                                    <div className="flex justify-between items-center py-2 text-sm">
                                        <span className="text-neutral-600 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span>
                                            Doctor Consultation
                                        </span>
                                        <span className="font-medium">{formatLKR(bill.doctor_fee)}</span>
                                    </div>

                                    {/* Service Charge */}
                                    <div className="flex justify-between items-center py-2 text-sm">
                                        <span className="text-neutral-600 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-neutral-400 inline-block"></span>
                                            Service Charge
                                        </span>
                                        <span className="font-medium">{formatLKR(bill.service_charge)}</span>
                                    </div>

                                    {/* Lab Tests — itemized */}
                                    {bill.lab_items && bill.lab_items.length > 0 && (
                                        <div className="py-2">
                                            <div className="flex justify-between items-center text-sm mb-1">
                                                <span className="text-neutral-600 flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-purple-400 inline-block"></span>
                                                    Lab Tests
                                                </span>
                                                <span className="font-medium">{formatLKR(bill.lab_total || 0)}</span>
                                            </div>
                                            <div className="ml-4 space-y-0.5 border-l-2 border-purple-100 pl-3">
                                                {bill.lab_items.map((lt: any, i: number) => (
                                                    <div key={i} className="flex justify-between text-xs text-neutral-400">
                                                        <span>{lt.name}</span>
                                                        <span>{formatLKR(lt.price)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Medicines — itemized */}
                                    {bill.medicine_items && bill.medicine_items.length > 0 && (
                                        <div className="py-2">
                                            <div className="flex justify-between items-center text-sm mb-1">
                                                <span className="text-neutral-600 flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                                                    Medicines Dispensed
                                                </span>
                                                <span className="font-medium">{formatLKR(bill.pharmacy_total || 0)}</span>
                                            </div>
                                            <div className="ml-4 space-y-0.5 border-l-2 border-emerald-100 pl-3">
                                                {bill.medicine_items.map((m: any, i: number) => (
                                                    <div key={i} className="flex justify-between text-xs text-neutral-400">
                                                        <span>{m.medicine_name} <span className="text-neutral-300">× {m.qty}</span></span>
                                                        <span>{formatLKR(m.line_total || 0)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Note: pending pharmacy */}
                                    {(!bill.medicine_items || bill.medicine_items.length === 0) && Number(bill.pharmacy_total) === 0 && (
                                        <div className="py-1 text-xs text-neutral-400 italic flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-emerald-200 inline-block"></span>
                                            Medicines — pending dispensing
                                        </div>
                                    )}

                                    {/* Total */}
                                    <div className="border-t mt-3 pt-4 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-neutral-900">Total Amount</span>
                                            <span className="text-xl font-bold text-amber-700">{formatLKR(bill.total_amount)}</span>
                                        </div>
                                        
                                        <div className="flex justify-between items-center bg-neutral-50 p-3 rounded border">
                                            <span className="text-sm font-semibold">Payment Status</span>
                                            <StatusBadge status={bill.status} kind="bill" />
                                        </div>
                                        {bill.status === 'PAID' && bill.paid_at && (
                                            <p className="text-xs text-neutral-400 text-center">
                                                Paid on {new Date(bill.paid_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                                                {bill.payment_method && ` via ${bill.payment_method}`}
                                            </p>
                                        )}
                                        {bill.status !== 'PAID' && (
                                            <p className="text-xs text-neutral-400 text-center italic">
                                                Please visit the reception counter to complete payment.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                </div>
            </div>
        </div>
    );
}
