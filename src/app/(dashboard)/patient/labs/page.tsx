'use client';

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
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="p-8 space-y-6 max-w-5xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold">Lab Reports</h1>
                <p className="text-neutral-500">View and download your test results.</p>
            </div>

            {loading ? <div>Loading...</div> : data.length === 0 ? (
                <div className="text-neutral-500">No lab reports found.</div>
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
                                        <h3 className="font-bold text-lg">{item.testName}</h3>
                                        <p className="text-sm text-neutral-500">{item.description}</p>
                                        <div className="text-xs text-neutral-400 mt-1">
                                            Ordered by {item.doctorName} • {new Date(item.requested_at).toLocaleDateString()}
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
