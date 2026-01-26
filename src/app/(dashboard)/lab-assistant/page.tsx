
'use client';

import { useEffect, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UploadModal } from '@/components/lab/UploadModal';
import { FlaskConical, Calendar, UserCheck, Search, History, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface LabRequest {
    request_id: number;
    patient_name: string;
    doctor_name: string;
    test_name: string;
    status: string;
    requested_at: string;
    appointment_date: string;
}

export default function LabAssistantDashboard() {
    const [requests, setRequests] = useState<LabRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchRequests = async () => {
        try {
            const res = await fetch('/api/lab-assistant/requests');
            if (res.ok) {
                const data = await res.json();
                setRequests(data);
            }
        } catch (error) {
            console.error('Failed to fetch requests', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleSuccess = () => {
        fetchRequests();
    };

    // Filter Logic
    const filteredRequests = requests.filter(req =>
        req.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.test_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const pendingRequests = filteredRequests.filter(req => req.status === 'PENDING');
    const historyRequests = filteredRequests.filter(req => req.status !== 'PENDING');

    const RequestTable = ({ data, historyMode = false }: { data: LabRequest[], historyMode?: boolean }) => (
        <div className="rounded-md border bg-white overflow-hidden">
            <Table>
                <TableHeader className="bg-gray-50">
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
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                No requests found.
                            </TableCell>
                        </TableRow>
                    ) : (
                        data.map((req) => (
                            <TableRow key={req.request_id} className="hover:bg-gray-50/50 transition-colors">
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                                            {req.patient_name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-gray-900">{req.patient_name}</div>
                                            <div className="text-xs text-gray-500">ID: #{req.request_id}</div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                                        {req.test_name}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5 text-gray-600">
                                        <UserCheck className="h-3.5 w-3.5" />
                                        {req.doctor_name}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5 text-gray-500 text-sm">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {format(new Date(req.appointment_date), 'MMM dd, yyyy')}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge className={`${req.status === 'PENDING'
                                            ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                                            : 'bg-green-100 text-green-800 border-green-200'
                                        } shadow-none hover:bg-opacity-80`}>
                                        {req.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    {req.status === 'PENDING' ? (
                                        <UploadModal
                                            requestId={req.request_id}
                                            patientName={req.patient_name}
                                            testName={req.test_name}
                                            onSuccess={handleSuccess}
                                        />
                                    ) : (
                                        <span className="text-xs text-gray-400 font-medium">Completed</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900">Lab Dashboard</h2>
                    <p className="text-muted-foreground mt-1">Manage pending test requests and view history.</p>
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search patient or test..."
                        className="pl-9 bg-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

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
                                <FlaskConical className="h-5 w-5 text-indigo-600" />
                                Pending Tests
                            </CardTitle>
                            <CardDescription>
                                Requests waiting for result upload.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="text-center py-10 text-gray-500 animate-pulse">Loading requests...</div>
                            ) : (
                                <RequestTable data={pendingRequests} />
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="history" className="mt-0">
                    <Card className="border-none shadow-md bg-white/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <History className="h-5 w-5 text-gray-600" />
                                Request History
                            </CardTitle>
                            <CardDescription>
                                Completed lab tests and past records.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="text-center py-10 text-gray-500 animate-pulse">Loading history...</div>
                            ) : (
                                <RequestTable data={historyRequests} historyMode={true} />
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
