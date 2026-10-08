'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FormAlert, PasswordField } from '@/components/ui/text-field';

export function ChangePasswordCard() {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<{ confirm?: string; next?: string }>({});

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        const currentPassword = String(data.get('currentPassword') ?? '');
        const newPassword = String(data.get('newPassword') ?? '');
        const confirmPassword = String(data.get('confirmPassword') ?? '');

        setError('');
        const problems: { confirm?: string; next?: string } = {};
        if (newPassword.length < 6) problems.next = 'Use at least 6 characters.';
        else if (newPassword === currentPassword) problems.next = 'Choose a password different from the current one.';
        if (newPassword !== confirmPassword) problems.confirm = 'The two new passwords do not match.';
        setFieldErrors(problems);
        if (problems.next || problems.confirm) return;

        setBusy(true);
        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) throw new Error(body?.message || 'Could not change your password.');
            toast.success('Password changed. Other devices have been signed out.');
            form.reset();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not change your password.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <Card className="shadow-[var(--shadow-card)]">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <KeyRound className="h-5 w-5 text-emerald-700" aria-hidden /> Password
                </CardTitle>
                <CardDescription>Choose a new password. You stay signed in here; other devices are signed out.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit} noValidate>
                <CardContent className="max-w-md space-y-4">
                    {error && <FormAlert>{error}</FormAlert>}
                    <PasswordField label="Current password" name="currentPassword" autoComplete="current-password" required />
                    <PasswordField label="New password" name="newPassword" autoComplete="new-password" required error={fieldErrors.next} hint="At least 6 characters." />
                    <PasswordField label="Confirm new password" name="confirmPassword" autoComplete="new-password" required error={fieldErrors.confirm} />
                </CardContent>
                <CardFooter className="border-t pt-4">
                    <Button type="submit" disabled={busy}>{busy ? 'Updating…' : 'Change password'}</Button>
                </CardFooter>
            </form>
        </Card>
    );
}
