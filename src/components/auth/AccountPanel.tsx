'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UserRound } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/state-views';
import { FormAlert, TextField } from '@/components/ui/text-field';
import { useAuth } from '@/context/AuthContext';
import { ChangePasswordCard } from '@/components/auth/ChangePasswordCard';

/**
 * The one place every role manages their sign-in details: name, phone and password.
 * Role-specific information (a doctor's fee and schedule, a patient's medical history) lives on that role's own page.
 */
export function AccountPanel() {
    const { refresh } = useAuth();
    const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [fieldError, setFieldError] = useState<{ field?: string; message?: string }>({});

    const load = () => {
        setState('loading');
        fetch('/api/account')
            .then(async (res) => {
                if (!res.ok) throw new Error();
                const { account } = await res.json();
                setEmail(account.email);
                setName(account.name ?? '');
                setPhone(account.phone ?? '');
                setState('ready');
            })
            .catch(() => setState('error'));
    };
    useEffect(load, []);

    async function save(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setFieldError({});
        setBusy(true);
        try {
            const res = await fetch('/api/account', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) {
                if (body?.field) setFieldError({ field: body.field, message: body.message });
                else setError(body?.message || 'Could not save your details.');
                return;
            }
            toast.success('Your details were saved');
            await refresh();
        } catch {
            setError('Could not save your details. Check your connection and try again.');
        } finally {
            setBusy(false);
        }
    }

    if (state === 'loading') {
        return <div className="space-y-6"><Skeleton className="h-64 w-full" /><Skeleton className="h-72 w-full" /></div>;
    }
    if (state === 'error') {
        return <ErrorState title="Could not load your account" onRetry={load} />;
    }

    return (
        <div className="space-y-6">
            <Card className="shadow-[var(--shadow-card)]">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <UserRound className="h-5 w-5 text-emerald-700" aria-hidden /> Your details
                    </CardTitle>
                    <CardDescription>This is how you appear to your colleagues and patients.</CardDescription>
                </CardHeader>
                <form onSubmit={save} noValidate>
                    <CardContent className="max-w-md space-y-4">
                        {error && <FormAlert>{error}</FormAlert>}
                        <TextField
                            label="Full name" value={name} onChange={(e) => setName(e.target.value)}
                            autoComplete="name" required
                            error={fieldError.field === 'name' ? fieldError.message : null}
                        />
                        <TextField
                            label="Phone number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                            autoComplete="tel"
                            error={fieldError.field === 'phone' ? fieldError.message : null}
                        />
                        <TextField
                            label="Email" value={email} readOnly disabled
                            hint="Your email is your sign-in. To change it, ask an administrator."
                        />
                    </CardContent>
                    <CardFooter className="border-t pt-4">
                        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save details'}</Button>
                    </CardFooter>
                </form>
            </Card>

            <ChangePasswordCard />
        </div>
    );
}
