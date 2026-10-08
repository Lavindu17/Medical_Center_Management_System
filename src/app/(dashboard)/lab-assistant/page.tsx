'use client';
import { formatDate } from '@/lib/dates';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/state-views';
import { StatusBadge } from '@/components/ui/status-badge';

import { useCallback, useEffect, useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UploadModal } from '@/components/lab/UploadModal';
import { FlaskConical, Calendar, UserCheck, Search, History, Clock, RefreshCw, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface LabRequest {
    request_id: number;
    patient_name: string | null;
    doctor_name: string | null;
    test_name: string | null;
    status: string;
    requested_at: string;
    appointment_date: string | null;
    result_url?: string | null;
}

// Defined at module level: a component declared inside the page is a new component on every render, which
// remounts every row (and closes an open upload dialog) whenever the page's state changes.
function RequestTable({ data, onUploaded }: { data: LabRequest[]; onUploaded: () => void }) {
    return (
        <div className="rounded-md border bg-white overflow-hidden">
            <Table>
                <TableHeader className="bg-neutral-50">
                    <TableRow>
                        <TableHead className="w-[180px]">Patient</TableHead>
                        <TableHead>Test Required</TableHead>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="p-0">
                                <EmptyState icon={FlaskConical} title="No requests here" description="Test requests from doctors will appear in this list." className="border-0" />
                            </TableCell>
                        </TableRow>
                    ) : (
                        data.map((req) => (
                            <TableRow key={req.request_id} className="hover:bg-neutral-50/50 transition-colors">
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold">
                                            {(req.patient_name ?? '?').charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-neutral-900">{req.patient_name ?? 'Unknown patient'}</div>
                                            <div className="text-xs text-neutral-500">ID: #{req.request_id}</div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                        {req.test_name ?? 'Unknown test'}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5 text-neutral-600">
                                        <UserCheck className="h-3.5 w-3.5" />
                                        {req.doctor_name ?? '—'}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5 text-neutral-500 text-sm">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {formatDate(req.appointment_date)}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <StatusBadge status={req.status} kind="lab" size="sm" />
                                </TableCell>
                                <TableCell className="text-right">
                                    {req.status === 'PENDING' ? (
                                        <UploadModal
                                            requestId={req.request_id}
                                            patientName={req.patient_name ?? 'Patient'}
                                            testName={req.test_name ?? 'Test'}
                                            onSuccess={onUploaded}
                                        />
                                    ) : req.result_url ? (
                                        <a
                                            href={req.result_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                                        >
                                            <FileText className="h-3.5 w-3.5" /> View report
                                        </a>
                                    ) : (
                                        <span className="text-xs text-neutral-400 font-medium">Completed</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

export default function LabAssistantDashboard() {
    const [requests, setRequests] = useState<LabRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchRequests = useCallback(async () => {
        try {
            const res = await fetch('/api/lab-assistant/requests', { cache: 'no-store' });
            if (!res.ok) throw new Error(`Request failed (${res.status})`);
            const data = await res.json();
            if (!Array.isArray(data)) throw new Error('Unexpected response');
            setRequests(data);
            setFailed(false);
        } catch (error) {
            console.error('Failed to fetch requests', error);
            setFailed(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const first = setTimeout(fetchRequests, 0);
        // New requests arrive while the page is open (the bell tells you); keep the list current too
        const timer = setInterval(() => { if (document.visibilityState === 'visible') fetchRequests(); }, 30_000);
        return () => { clearTimeout(first); clearInterval(timer); };
    }, [fetchRequests]);

    // Filter Logic
    const needle = searchTerm.toLowerCase();
    const filteredRequests = requests.filter(req =>
        (req.patient_name ?? '').toLowerCase().includes(needle) ||
        (req.test_name ?? '').toLowerCase().includes(needle)
    );

    const pendingRequests = filteredRequests.filter(req => req.status === 'PENDING');
    const historyRequests = filteredRequests.filter(req => req.status !== 'PENDING');

    const errorNotice = failed && (
        <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
            <span>Could not load lab requests. The list below may be out of date.</span>
            <Button size="sm" variant="outline" onClick={fetchRequests}>Try again</Button>
        </div>
    );

    return (
        <div className="space-y-6">
            <PageHeader
                title="Lab Requests"
                description="Manage pending test requests and view history."
                actions={<div className="flex w-full items-center gap-2 sm:w-auto">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search patient or test..."
                            className="pl-9 bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" size="icon" onClick={fetchRequests} aria-label="Refresh requests" title="Refresh">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>}
            />

            <Tabs defaultValue="pending" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="pending" className="gap-2">
                        <Clock className="h-4 w-4" />
                        Pending ({pendingRequests.length})
                    </TabsTrigger>
                    <TabsTrigger value="history" className="gap-2">
                        <History className="h-4 w-4" />
                        History
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="mt-0">
                    <Card className="border-none shadow-md bg-white/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FlaskConical className="h-5 w-5 text-emerald-600" />
                                Pending Tests
                            </CardTitle>
                            <CardDescription>
                                Requests waiting for result upload.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {errorNotice}
                            {loading ? (
                                <div className="text-center py-10 text-neutral-500 animate-pulse">Loading requests...</div>
                            ) : (
                                <RequestTable data={pendingRequests} onUploaded={fetchRequests} />
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="history" className="mt-0">
                    <Card className="border-none shadow-md bg-white/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <History className="h-5 w-5 text-neutral-600" />
                                Request History
                            </CardTitle>
                            <CardDescription>
                                Completed lab tests and past records.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {errorNotice}
                            {loading ? (
                                <div className="text-center py-10 text-neutral-500 animate-pulse">Loading history...</div>
                            ) : (
                                <RequestTable data={historyRequests} onUploaded={fetchRequests} />
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
