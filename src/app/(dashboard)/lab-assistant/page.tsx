
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
import { UploadModal } from '@/components/lab/UploadModal';
import { FlaskConical, Calendar, User, UserCheck } from 'lucide-react';
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

    // Function to reload after successful upload
    const handleSuccess = () => {
        fetchRequests();
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900">Lab Dashboard</h2>
                    <p className="text-muted-foreground mt-1">Manage pending test requests and uploads.</p>
                </div>
                <div className="bg-white p-2 rounded-lg shadow-sm border px-4">
                    <span className="text-sm text-gray-500">Pending Requests: </span>
                    <span className="font-bold text-indigo-600 text-lg">{requests.length}</span>
                </div>
            </div>

            <Card className="border-none shadow-md bg-white/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FlaskConical className="h-5 w-5 text-indigo-600" />
                        Pending Tests
                    </CardTitle>
                    <CardDescription>
                        List of appointments requiring lab tests. Upload results to complete the request.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-10 text-gray-500 animate-pulse">Loading requests...</div>
                    ) : requests.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg bg-gray-50/50">
                            <FlaskConical className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                            <h3 className="text-lg font-medium text-gray-900">No Pending Requests</h3>
                            <p className="text-sm text-gray-500 max-w-sm mx-auto mt-1">
                                Great job! All lab requests have been processed.
                            </p>
                        </div>
                    ) : (
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
                                    {requests.map((req) => (
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
                                                <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200 shadow-none">
                                                    {req.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <UploadModal
                                                    requestId={req.request_id}
                                                    patientName={req.patient_name}
                                                    testName={req.test_name}
                                                    onSuccess={handleSuccess}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
