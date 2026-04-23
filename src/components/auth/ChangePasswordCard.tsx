'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck } from 'lucide-react';

export function ChangePasswordCard() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        const formData = new FormData(e.currentTarget);
        const currentPassword = formData.get('currentPassword') as string;
        const newPassword = formData.get('newPassword') as string;
        const confirmPassword = formData.get('confirmPassword') as string;

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            setIsLoading(false);
            return;
        }

        if (newPassword.length < 6) {
            setError('New password must be at least 6 characters');
            setIsLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || 'Failed to change password');
            }

            setSuccess('Password changed successfully');
            (e.target as HTMLFormElement).reset();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                    <ShieldCheck className="h-5 w-5 text-neutral-500" /> Security Settings
                </CardTitle>
                <CardDescription>Update your password to keep your account secure.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                    {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-100">{error}</div>}
                    {success && <div className="p-3 text-sm text-emerald-600 bg-emerald-50 rounded-md border border-emerald-100">{success}</div>}

                    <div className="space-y-2">
                        <Label htmlFor="currentPassword">Current Password</Label>
                        <Input id="currentPassword" name="currentPassword" type="password" required className="max-w-md" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input id="newPassword" name="newPassword" type="password" required className="max-w-md" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm New Password</Label>
                        <Input id="confirmPassword" name="confirmPassword" type="password" required className="max-w-md" />
                    </div>
                </CardContent>
                <CardFooter className="border-t pt-4">
                    <Button type="submit" disabled={isLoading} className="bg-neutral-900 text-white hover:bg-neutral-800">
                        {isLoading ? 'Updating...' : 'Change Password'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
