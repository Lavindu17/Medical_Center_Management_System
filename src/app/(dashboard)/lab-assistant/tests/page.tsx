
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, TestTube2 } from 'lucide-react';

interface LabTest {
    id: number;
    name: string;
    description: string;
    price: string;
}

export default function LabTestsPage() {
    const [tests, setTests] = useState<LabTest[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Form State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newTest, setNewTest] = useState({ name: '', description: '', price: '' });
    const [submitting, setSubmitting] = useState(false);

    const fetchTests = async () => {
        try {
            const res = await fetch('/api/lab-assistant/tests');
            if (res.ok) {
                const data = await res.json();
                setTests(data);
            }
        } catch (error) {
            console.error('Failed to fetch tests', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTests();
    }, []);

    const handleAddTest = async () => {
        setSubmitting(true);
        try {
            const res = await fetch('/api/lab-assistant/tests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTest),
            });

            if (res.ok) {
                setIsAddOpen(false);
                setNewTest({ name: '', description: '', price: '' });
                fetchTests();
            } else {
                alert('Failed to add test');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    const filteredTests = tests.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900">Lab Tests</h2>
                    <p className="text-muted-foreground mt-1">Manage the catalog of available lab tests.</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-indigo-600 hover:bg-indigo-700">
                            <Plus className="mr-2 h-4 w-4" /> Add New Test
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Lab Test</DialogTitle>
                            <DialogDescription>Add a new test to the catalog for doctors to select.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Test Name</Label>
                                <Input
                                    id="name"
                                    value={newTest.name}
                                    onChange={(e) => setNewTest({ ...newTest, name: e.target.value })}
                                    placeholder="e.g. Complete Blood Count (CBC)"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="price">Price (LKR)</Label>
                                <Input
                                    id="price"
                                    type="number"
                                    value={newTest.price}
                                    onChange={(e) => setNewTest({ ...newTest, price: e.target.value })}
                                    placeholder="e.g. 1500"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="desc">Description</Label>
                                <Textarea
                                    id="desc"
                                    value={newTest.description}
                                    onChange={(e) => setNewTest({ ...newTest, description: e.target.value })}
                                    placeholder="Optional description..."
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                            <Button onClick={handleAddTest} disabled={!newTest.name || !newTest.price || submitting}>
                                {submitting ? 'Saving...' : 'Save Test'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="border-none shadow-md bg-white/50 backdrop-blur-sm">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <TestTube2 className="h-5 w-5 text-indigo-600" />
                            Test Catalog
                        </CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search tests..."
                                className="pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border bg-white overflow-hidden">
                        <Table>
                            <TableHeader className="bg-gray-50">
                                <TableRow>
                                    <TableHead>Test Name</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Price</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-8">Loading...</TableCell>
                                    </TableRow>
                                ) : filteredTests.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                            No tests found. Add one to get started.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredTests.map((test) => (
                                        <TableRow key={test.id} className="hover:bg-gray-50/50">
                                            <TableCell className="font-medium">{test.name}</TableCell>
                                            <TableCell className="text-muted-foreground">{test.description || '-'}</TableCell>
                                            <TableCell className="text-right font-mono">
                                                LKR {parseFloat(test.price).toFixed(2)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
