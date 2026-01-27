
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Banknote, CreditCard, Printer } from 'lucide-react';

export default function BillingPage() {
    const [bills, setBills] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedBill, setSelectedBill] = useState<any>(null);
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [isPayOpen, setIsPayOpen] = useState(false);

    useEffect(() => {
        fetchBills();
    }, []);

    const fetchBills = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/receptionist/billing');
            if (res.ok) setBills(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handlePay = async () => {
        if (!selectedBill) return;
        if (!confirm(`Confirm payment of LKR ${selectedBill.total_amount} via ${paymentMethod}?`)) return;

        try {
            const res = await fetch('/api/receptionist/billing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bill_id: selectedBill.id,
                    payment_method: paymentMethod
                })
            });

            if (res.ok) {
                alert('Payment Successful!');
                setIsPayOpen(false);
                fetchBills();
            } else {
                alert('Payment Failed');
            }
        } catch (e) {
            console.error(e);
        }
    };

    const openPay = (bill: any) => {
        setSelectedBill(bill);
        setIsPayOpen(true);
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-neutral-900">Billing & Payments</h1>
                <p className="text-neutral-500">Collect payments and finalize appointments.</p>
            </div>

            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b bg-neutral-50 font-semibold text-sm text-neutral-500">
                    <div className="col-span-3">Patient</div>
                    <div className="col-span-3">Doctor</div>
                    <div className="col-span-3">Details</div>
                    <div className="col-span-1">Total</div>
                    <div className="col-span-2 text-right">Actions</div>
                </div>
                <div className="divide-y">
                    {loading ? <div className="p-8 text-center text-neutral-400">Loading...</div> : bills.length === 0 ? <div className="p-8 text-center text-neutral-500">No pending bills.</div> : bills.map((bill) => (
                        <div key={bill.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-neutral-50 transition-colors">
                            <div className="col-span-3">
                                <div className="font-medium text-neutral-900">{bill.patient_name}</div>
                                <div className="text-xs text-neutral-500">{new Date(bill.appointment_date).toLocaleDateString()}</div>
                            </div>
                            <div className="col-span-3 text-sm text-neutral-700">{bill.doctor_name}</div>
                            <div className="col-span-3 text-xs text-neutral-500 space-y-1">
                                <div>Doc Fee: LKR {bill.doctor_fee}</div>
                                <div>Pharmacy: LKR {bill.pharmacy_total}</div>
                                <div>Lab: LKR {bill.lab_total}</div>
                            </div>
                            <div className="col-span-1 font-bold text-lg text-emerald-700">LKR {bill.total_amount}</div>
                            <div className="col-span-2 flex justify-end gap-2">
                                <Button className="bg-emerald-600 hover:bg-emerald-700 h-8 px-3 text-xs" onClick={() => openPay(bill)}>
                                    <Banknote className="h-3 w-3 mr-1" /> Pay
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Process Payment</DialogTitle></DialogHeader>
                    {selectedBill && (
                        <div className="space-y-4 pt-4">
                            <div className="bg-neutral-50 p-4 rounded-lg space-y-2 text-sm">
                                <div className="flex justify-between"><span>Doctor Fee:</span> <span>LKR {selectedBill.doctor_fee}</span></div>
                                <div className="flex justify-between"><span>Pharmacy:</span> <span>LKR {selectedBill.pharmacy_total}</span></div>
                                <div className="flex justify-between"><span>Lab Charges:</span> <span>LKR {selectedBill.lab_total}</span></div>
                                <div className="flex justify-between"><span>Service Charge:</span> <span>LKR {selectedBill.service_charge}</span></div>
                                <div className="border-t pt-2 mt-2 flex justify-between font-bold text-lg"><span>Total:</span> <span>LKR {selectedBill.total_amount}</span></div>
                            </div>

                            <div className="space-y-2">
                                <Label>Payment Method</Label>
                                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CASH">Cash</SelectItem>
                                        <SelectItem value="CARD">Credit/Debit Card</SelectItem>
                                        <SelectItem value="INSURANCE">Insurance</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button onClick={handlePay} className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-lg">
                                Confirm Payment
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
