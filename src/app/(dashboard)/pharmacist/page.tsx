'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Pill, AlertTriangle, FileText, Activity } from 'lucide-react';
import Link from 'next/link';

export default function PharmacistDashboard() {
    const [stats, setStats] = useState({
        pendingPrescriptions: 0,
        lowStockCount: 0,
        totalMedicines: 0,
        expiredBatchesCount: 0,
        expiringSoonCount: 0
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
            title: 'Expired Batches',
            value: stats.expiredBatchesCount,
            icon: AlertTriangle,
            description: 'Need immediate removal',
            color: 'text-red-600',
            bg: 'bg-red-50',
            href: '/pharmacist/alerts'
        },
        {
            title: 'Expiring Soon',
            value: stats.expiringSoonCount,
            icon: AlertTriangle,
            description: 'Within 30 days',
            color: 'text-amber-600',
            bg: 'bg-amber-50',
            href: '/pharmacist/alerts'
        },
        {
            title: 'Low Stock Alerts',
            value: stats.lowStockCount,
            icon: AlertTriangle,
            description: 'Items below threshold',
            color: 'text-orange-600',
            bg: 'bg-orange-50',
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

            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {cards.map((card, i) => {
                    const isUrgent = (card.title === 'Expired Batches' && card.value > 0);
                    return (
                        <Link key={i} href={card.href} className="block group">
                            <Card className={`transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${card.bg} border-none ${isUrgent ? 'animate-pulse' : ''}`}>
                                <CardHeader className="flex flex-row items-start justify-between pb-3">
                                    <div className="space-y-1 flex-1">
                                        <CardTitle className="text-sm font-semibold text-neutral-700">{card.title}</CardTitle>
                                        <p className="text-xs text-neutral-500">{card.description}</p>
                                    </div>
                                    <div className={`p-3 rounded-lg ${card.bg} ring-2 ring-white/50`}>
                                        <card.icon className={`h-6 w-6 ${card.color}`} />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className={`text-4xl font-bold tracking-tight ${card.color}`}>
                                        {card.value}
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    );
                })}
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
