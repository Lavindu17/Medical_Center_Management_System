'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Pill, AlertTriangle, FileText, Activity } from 'lucide-react';
import Link from 'next/link';

export default function PharmacistDashboard() {
    const [stats, setStats] = useState({
        pendingPrescriptions: 0,
        lowStockCount: 0,
        totalMedicines: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/pharmacist/stats')
            .then(res => res.json())
            .then(data => setStats(data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const cards = [
        {
            title: 'Pending Prescriptions',
            value: stats.pendingPrescriptions,
            icon: FileText,
            description: 'Require dispensing',
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            href: '/pharmacist/prescriptions'
        },
        {
            title: 'Low Stock Alerts',
            value: stats.lowStockCount,
            icon: AlertTriangle,
            description: 'Items below threshold',
            color: 'text-amber-600',
            bg: 'bg-amber-50',
            href: '/pharmacist/inventory'
        },
        {
            title: 'Total Inventory',
            value: stats.totalMedicines,
            icon: Pill,
            description: 'Medicine types registered',
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            href: '/pharmacist/inventory'
        }
    ];

    if (loading) return <div className="p-8">Loading Dashboard...</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-neutral-900">Pharmacist Dashboard</h1>
                <p className="text-neutral-500">Overview of pharmacy operations and inventory.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {cards.map((card, i) => (
                    <Link key={i} href={card.href} className="block transition-transform hover:-translate-y-1">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-neutral-600">{card.title}</CardTitle>
                                <card.icon className={`h-4 w-4 ${card.color}`} />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{card.value}</div>
                                <p className="text-xs text-neutral-400 mt-1">{card.description}</p>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            {/* Actions / Recent */}
            <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-emerald-100 bg-emerald-50/30">
                    <CardHeader>
                        <CardTitle className="text-emerald-900">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="flex gap-4">
                        <Link href="/pharmacist/prescriptions" className="text-sm font-semibold text-emerald-700 hover:underline">
                            → Dispense Medicine
                        </Link>
                        <Link href="/pharmacist/inventory" className="text-sm font-semibold text-emerald-700 hover:underline">
                            → Manage Inventory
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
