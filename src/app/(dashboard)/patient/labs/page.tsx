'use client';
import { asDoctor } from '@/lib/names';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from 'sonner';
import { EmptyState, LoadingState } from '@/components/ui/state-views';
import { PageHeader } from '@/components/ui/page-header';
import { formatDate } from '@/lib/dates';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function LabReportsPage() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        fetch('/api/auth/session')
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('Unauthorized');
            })
            .then(data => {
                setUser(data.user);
                return fetch(`/api/patient/records?patientId=${data.user.id}&type=labs`);
            })
            .then(res => res.json())
            .then(setData)
            .catch((e) => { console.error(e); toast.error('Could not load this page. Please refresh and try again.'); })
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <PageHeader title="Lab Reports" description="View and download your test results." />

            {loading ? <LoadingState label="Loading your lab reports…" /> : data.length === 0 ? (
                <EmptyState title="No lab reports yet" description="When a doctor orders a test, the result will be available here to view and download." />
            ) : (
                <div className="grid gap-4">
                    {data.map((item, i) => (
                        <Card key={i}>
                            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                                <div className="flex min-w-0 items-start gap-3.5">
                                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-700" aria-hidden>
                                        <FileText className="h-5 w-5" />
                                    </span>
                                    <div className="min-w-0">
                                        <h2 className="font-bold text-neutral-900">{item.testName}</h2>
                                        {item.description && <p className="text-sm text-neutral-600">{item.description}</p>}
                                        <p className="mt-1 text-sm text-neutral-500">
                                            Ordered by {asDoctor(item.doctorName)} · {formatDate(item.requested_at)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-3 sm:justify-end">
                                    <StatusBadge status={item.status} kind="lab" size="sm" />
                                    {item.result_url && (
                                        <Button variant="outline" asChild className="h-11 flex-1 sm:h-9 sm:flex-none">
                                            <a href={item.result_url} target="_blank" rel="noopener noreferrer">
                                                <Download className="mr-2 h-4 w-4" aria-hidden /> Download report
                                            </a>
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
