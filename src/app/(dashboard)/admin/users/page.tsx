'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Trash2, Edit } from 'lucide-react';
import { User } from '@/types';

export default function UserManagementPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Create Dialog
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '', email: '', password: '', role: 'DOCTOR', phone: '', specialization: '', licenseNumber: ''
    });

    // Edit Dialog
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editFormData, setEditFormData] = useState({
        name: '', email: '', role: '', phone: ''
    });

    useEffect(() => {
        fetchUsers();
    }, []);

    async function fetchUsers() {
        try {
            const res = await fetch('/api/users');
            const data = await res.json();
            setUsers(data);
        } catch (error) {
            console.error('Failed to fetch users', error);
        } finally {
            setIsLoading(false);
        }
    }

    async function handleCreateUser(e: React.FormEvent) {
        e.preventDefault();
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message);
            }

            alert('User created successfully');
            setIsDialogOpen(false);
            fetchUsers();
            setFormData({ name: '', email: '', password: '', role: 'DOCTOR', phone: '', specialization: '', licenseNumber: '' });
        } catch (error: any) {
            alert(error.message);
        }
    }

    const handleEditClick = (user: User) => {
        setEditingUser(user);
        setEditFormData({
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone || ''
        });
        setIsEditOpen(true);
    };

    async function handleUpdateUser(e: React.FormEvent) {
        e.preventDefault();
        if (!editingUser) return;

        try {
            const res = await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...editFormData, id: editingUser.id }),
            });

            if (!res.ok) throw new Error('Failed to update');

            setIsEditOpen(false);
            fetchUsers();
        } catch (error: any) {
            alert('Error updating user');
        }
    }

    async function handleDeleteUser(id: string) {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

        try {
            const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');

            fetchUsers();
        } catch (error) {
            alert('Error deleting user');
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
                    <p className="text-neutral-500">Manage staff access and patient accounts.</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-emerald-600 hover:bg-emerald-700">
                            <Plus className="mr-2 h-4 w-4" /> Add Staff
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Add New Staff Member</DialogTitle>
                            <DialogDescription>
                                Create a new account for a Doctor, Pharmacist, or other staff.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateUser} className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Name</Label>
                                    <Input name="name" value={formData.name} onChange={handleInputChange} required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Role</Label>
                                    <Select
                                        value={formData.role}
                                        onValueChange={(val) => setFormData({ ...formData, role: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="DOCTOR">Doctor</SelectItem>
                                            <SelectItem value="PHARMACIST">Pharmacist</SelectItem>
                                            <SelectItem value="LAB_ASSISTANT">Lab Assistant</SelectItem>
                                            <SelectItem value="RECEPTIONIST">Receptionist</SelectItem>
                                            <SelectItem value="ADMIN">Admin</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input type="email" name="email" value={formData.email} onChange={handleInputChange} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Password</Label>
                                <Input type="password" name="password" value={formData.password} onChange={handleInputChange} required />
                            </div>

                            {formData.role === 'DOCTOR' && (
                                <div className="grid grid-cols-2 gap-4 bg-neutral-50 p-2 rounded-md">
                                    <div className="space-y-2">
                                        <Label>Specialization</Label>
                                        <Input name="specialization" value={formData.specialization} onChange={handleInputChange} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>License #</Label>
                                        <Input name="licenseNumber" value={formData.licenseNumber} onChange={handleInputChange} required />
                                    </div>
                                </div>
                            )}

                            <DialogFooter>
                                <Button type="submit">Create User</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Users</CardTitle>
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
                            <Input type="search" placeholder="Search by name or email..." className="pl-8" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Joined</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24">Loading...</TableCell>
                                </TableRow>
                            ) : users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.name}</TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                      ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                                                user.role === 'DOCTOR' ? 'bg-emerald-100 text-emerald-800' :
                                                    user.role === 'PATIENT' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {user.role}
                                        </span>
                                    </TableCell>
                                    <TableCell>{user.phone || '-'}</TableCell>
                                    <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(user)}>
                                            <Edit className="h-4 w-4 text-neutral-500" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.id)}>
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Edit User Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit User</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleUpdateUser} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                                value={editFormData.name}
                                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                                value={editFormData.email}
                                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Phone</Label>
                            <Input
                                value={editFormData.phone}
                                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Role</Label>
                            <Select
                                value={editFormData.role}
                                onValueChange={(val) => setEditFormData({ ...editFormData, role: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DOCTOR">Doctor</SelectItem>
                                    <SelectItem value="PHARMACIST">Pharmacist</SelectItem>
                                    <SelectItem value="LAB_ASSISTANT">Lab Assistant</SelectItem>
                                    <SelectItem value="RECEPTIONIST">Receptionist</SelectItem>
                                    <SelectItem value="ADMIN">Admin</SelectItem>
                                    <SelectItem value="PATIENT">Patient</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter>
                            <Button type="submit">Update User</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
