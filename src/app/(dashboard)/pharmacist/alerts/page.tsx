'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package, Calendar, TrendingUp } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ExpiryAlertsPage() {
    const [alerts, setAlerts] = useState<any>({
        expired: [],
        expiringSoon: [],
        expiringLater: [],
        multiBatchWarnings: [],
        summary: {
            expiredCount: 0,
            expiringSoonCount: 0,
            expiringLaterCount: 0,
            multiBatchWarningsCount: 0
        }
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAlerts();
    }, []);

    const fetchAlerts = () => {
        fetch('/api/pharmacist/alerts')
            .then(res => res.json())
            .then(data => setAlerts(data))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (loading) return <div className="p-8">Loading Expiry Alerts...</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-neutral-900">Expiry Alerts</h1>
                <p className="text-neutral-500">Monitor and manage batch expiry dates</p>
            </div>

            {/* Summary Cards */}
            <div className="grid md:grid-cols-4 gap-4">
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="h-8 w-8 text-red-600" />
                            <div>
                                <p className="text-2xl font-bold text-red-900">{alerts.summary.expiredCount}</p>
                                <p className="text-xs text-red-700">Expired Batches</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <Calendar className="h-8 w-8 text-amber-600" />
                            <div>
                                <p className="text-2xl font-bold text-amber-900">{alerts.summary.expiringSoonCount}</p>
                                <p className="text-xs text-amber-700">Expiring Soon (30d)</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-yellow-200 bg-yellow-50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <Calendar className="h-8 w-8 text-yellow-600" />
                            <div>
                                <p className="text-2xl font-bold text-yellow-900">{alerts.summary.expiringLaterCount}</p>
                                <p className="text-xs text-yellow-700">Expiring Later (90d)</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <TrendingUp className="h-8 w-8 text-blue-600" />
                            <div>
                                <p className="text-2xl font-bold text-blue-900">{alerts.summary.multiBatchWarningsCount}</p>
                                <p className="text-xs text-blue-700">Multi-Batch Warnings</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs for Different Categories */}
            <Tabs defaultValue="expired" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="expired">
                        Expired ({alerts.summary.expiredCount})
                    </TabsTrigger>
                    <TabsTrigger value="soon">
                        Expiring Soon ({alerts.summary.expiringSoonCount})
                    </TabsTrigger>
                    <TabsTrigger value="later">
                        Expiring Later ({alerts.summary.expiringLaterCount})
                    </TabsTrigger>
                    <TabsTrigger value="multi">
                        Multi-Batch ({alerts.summary.multiBatchWarningsCount})
                    </TabsTrigger>
                </TabsList>

                {/* Expired Batches */}
                <TabsContent value="expired" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-red-900 flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5" />
                                Expired Batches - Require Immediate Action
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {alerts.expired.length === 0 ? (
                                <p className="text-center text-neutral-500 py-8">No expired batches. Great job!</p>
                            ) : (
                                <div className="space-y-3">
                                    {alerts.expired.map((batch: any) => (
                                        <div key={batch.batch_id} className="p-4 border border-red-200 bg-red-50 rounded-lg">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-semibold text-neutral-900">{batch.medicine_name}</h3>
                                                    <p className="text-sm text-neutral-600">Batch: {batch.batch_number}</p>
                                                </div>
                                                <Badge variant="destructive">Expired</Badge>
                                            </div>
                                            <div className="mt-2 flex gap-4 text-sm">
                                                <span className="text-neutral-600">Expired: {formatDate(batch.expiry_date)}</span>
                                                <span className="text-red-600 font-semibold">
                                                    {batch.days_expired} days ago
                                                </span>
                                                <span className="text-neutral-600">Qty: {batch.quantity_current} {batch.unit}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Expiring Soon (30 days) */}
                <TabsContent value="soon" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-amber-900 flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                Expiring Within 30 Days
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {alerts.expiringSoon.length === 0 ? (
                                <p className="text-center text-neutral-500 py-8">No batches expiring in the next 30 days.</p>
                            ) : (
                                <div className="space-y-3">
                                    {alerts.expiringSoon.map((batch: any) => (
                                        <div key={batch.batch_id} className="p-4 border border-amber-200 bg-amber-50 rounded-lg">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-semibold text-neutral-900">{batch.medicine_name}</h3>
                                                    <p className="text-sm text-neutral-600">Batch: {batch.batch_number}</p>
                                                </div>
                                                <Badge className="bg-amber-100 text-amber-800 border-amber-300">Expiring Soon</Badge>
                                            </div>
                                            <div className="mt-2 flex gap-4 text-sm">
                                                <span className="text-neutral-600">Expires: {formatDate(batch.expiry_date)}</span>
                                                <span className="text-amber-600 font-semibold">
                                                    {batch.days_until_expiry} days left
                                                </span>
                                                <span className="text-neutral-600">Qty: {batch.quantity_current} {batch.unit}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Expiring Later (31-90 days) */}
                <TabsContent value="later" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-yellow-900 flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                Expiring Within 90 Days
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {alerts.expiringLater.length === 0 ? (
                                <p className="text-center text-neutral-500 py-8">No batches expiring in 31-90 days.</p>
                            ) : (
                                <div className="space-y-3">
                                    {alerts.expiringLater.map((batch: any) => (
                                        <div key={batch.batch_id} className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-semibold text-neutral-900">{batch.medicine_name}</h3>
                                                    <p className="text-sm text-neutral-600">Batch: {batch.batch_number}</p>
                                                </div>
                                                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Monitor</Badge>
                                            </div>
                                            <div className="mt-2 flex gap-4 text-sm">
                                                <span className="text-neutral-600">Expires: {formatDate(batch.expiry_date)}</span>
                                                <span className="text-yellow-600 font-semibold">
                                                    {batch.days_until_expiry} days left
                                                </span>
                                                <span className="text-neutral-600">Qty: {batch.quantity_current} {batch.unit}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Multi-Batch Warnings */}
                <TabsContent value="multi" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-blue-900 flex items-center gap-2">
                                <Package className="h-5 w-5" />
                                Medicines with Multiple Batches & Large Expiry Gaps
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {alerts.multiBatchWarnings.length === 0 ? (
                                <p className="text-center text-neutral-500 py-8">No multi-batch warnings.</p>
                            ) : (
                                <div className="space-y-3">
                                    {alerts.multiBatchWarnings.map((med: any) => (
                                        <div key={med.medicine_id} className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-semibold text-neutral-900">{med.medicine_name}</h3>
                                                    <p className="text-sm text-neutral-600">{med.batch_count} batches in stock</p>
                                                </div>
                                                <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                                                    {med.expiry_gap_days} day gap
                                                </Badge>
                                            </div>
                                            <div className="mt-2 flex gap-4 text-sm">
                                                <span className="text-neutral-600">Earliest: {formatDate(med.earliest_expiry)}</span>
                                                <span className="text-neutral-600">Latest: {formatDate(med.latest_expiry)}</span>
                                                <span className="text-blue-600 font-semibold">Total: {med.total_stock} units</span>
                                            </div>
                                            <p className="mt-2 text-xs text-blue-700">
                                                ⚠️ Use FEFO logic: Dispense from earliest expiring batch first
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
