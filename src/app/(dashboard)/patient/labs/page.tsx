'use client';
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
                            <CardContent className="pt-6 flex justify-between items-center">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-purple-100 rounded-lg text-purple-600">
                                        <FileText className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-lg">{item.testName}</h2>
                                        <p className="text-sm text-neutral-500">{item.description}</p>
                                        <div className="text-xs text-neutral-400 mt-1">
                                            Ordered by {item.doctorName} • {formatDate(item.requested_at)}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <Badge variant={item.status === 'COMPLETED' ? 'default' : 'secondary'}>
                                        {item.status}
                                    </Badge>
                                    {item.result_url && (
                                        <Button variant="outline" size="sm" asChild>
                                            <a href={item.result_url} target="_blank" rel="noopener noreferrer">
                                                <Download className="mr-2 h-4 w-4" /> Download
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
