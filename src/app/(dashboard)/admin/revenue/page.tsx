'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DollarSign, TrendingUp, Activity, Pill } from 'lucide-react';

interface RevenueData {
    breakdown: {
        consultation: number;
        pharmacy: number;
        lab: number;
        total: number;
    };
    daily: {
        date: string;
        revenue: number;
        estimated_profit: number;
    }[];
}

export default function RevenuePage() {
    const [data, setData] = useState<RevenueData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchRevenue();
    }, []);

    async function fetchRevenue() {
        try {
            const res = await fetch('/api/admin/revenue');
            const json = await res.json();
            setData(json);
        } catch (error) {
            console.error('Failed to fetch revenue', error);
        } finally {
            setIsLoading(false);
        }
    }

    if (isLoading) return <div className="p-8">Loading analytics...</div>;
    if (!data) return <div className="p-8">Failed to load data.</div>;

    const { breakdown, daily } = data;

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Revenue Analytics</h2>
                <p className="text-neutral-500">Financial performance and profit analysis.</p>
            </div>

            {/* High Level Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${Number(breakdown.total).toLocaleString()}</div>
                        <p className="text-xs text-neutral-500">Lifetime gross revenue</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Consultation</CardTitle>
                        <Activity className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${Number(breakdown.consultation).toLocaleString()}</div>
                        <p className="text-xs text-neutral-500">Doctor fees collected</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pharmacy</CardTitle>
                        <Pill className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${Number(breakdown.pharmacy).toLocaleString()}</div>
                        <p className="text-xs text-neutral-500">Medicine sales</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Lab Tests</CardTitle>
                        <TrendingUp className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${Number(breakdown.lab).toLocaleString()}</div>
                        <p className="text-xs text-neutral-500">Diagnostic services</p>
                    </CardContent>
                </Card>
            </div>

            {/* Daily Revenue Chart (Simple CSS implementation) */}
            <Card className="col-span-4">
                <CardHeader>
                    <CardTitle>Daily Revenue (Last 30 Days)</CardTitle>
                    <CardDescription>
                        Gross revenue vs Estimated Profit
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full flex items-end justify-between gap-1 pt-4 border-b border-l border-neutral-200 dark:border-neutral-800">
                        {daily.length === 0 ? (
                            <div className="w-full flex items-center justify-center text-neutral-500">No data available for this period.</div>
                        ) : daily.map((day, i) => {
                            const maxVal = Math.max(...daily.map(d => Number(d.revenue)));
                            const height = maxVal > 0 ? (Number(day.revenue) / maxVal) * 100 : 0;

                            return (
                                <div key={i} className="group relative w-full h-full flex flex-col justify-end items-center mx-0.5">
                                    {/* Tooltip */}
                                    <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 bg-neutral-900 text-white text-xs p-2 rounded z-10 whitespace-nowrap">
                                        {new Date(day.date).toLocaleDateString()}: ${Number(day.revenue)}
                                    </div>
                                    {/* Bar */}
                                    <div
                                        className="w-full bg-blue-500 hover:bg-blue-600 transition-all rounded-t-sm"
                                        style={{ height: `${height}%` }}
                                    ></div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-neutral-500">
                        <span>30 days ago</span>
                        <span>Today</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
