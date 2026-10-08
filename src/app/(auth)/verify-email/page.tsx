'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormAlert, TextField } from '@/components/ui/text-field';
import { AuthShell } from '@/components/auth/AuthShell';

const RESEND_COOLDOWN_SECONDS = 60;

function VerifyEmailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const emailFromQuery = searchParams.get('email') || '';
    // Registration could not send the first email: let the person ask for another straight away
    const needsResend = searchParams.get('resend') === '1';

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [email, setEmail] = useState(emailFromQuery);
    const [cooldown, setCooldown] = useState(needsResend ? 0 : RESEND_COOLDOWN_SECONDS);

    // Count the resend cooldown down once a second (the server also limits resends to one a minute)
    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsLoading(true);
        setError(null);

        const formData = new FormData(event.currentTarget);
        const code = String(formData.get('code') ?? '').trim();

        try {
            const response = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), code }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || 'Verification failed.');

            router.push('/login?notice=verified');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Verification failed.');
            setIsLoading(false);
        }
    }

    async function handleResend() {
        if (!email.trim()) {
            setError('Enter your email address first.');
            return;
        }
        setError(null);
        try {
            const response = await fetch('/api/auth/resend-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            });
            const data = await response.json().catch(() => ({}));
            if (response.status === 429) {
                setCooldown(RESEND_COOLDOWN_SECONDS);
                throw new Error(data.message || 'Please wait a moment before requesting another code.');
            }
            toast.success('A new code is on its way.');
            setCooldown(RESEND_COOLDOWN_SECONDS);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not send a new code. Please try again.');
        }
    }

    return (
        <AuthShell
            title="Check your email"
            subtitle={
                emailFromQuery
                    ? <>We sent a 6-character code to <strong className="text-neutral-800">{emailFromQuery}</strong>.</>
                    : 'Enter the 6-character code we emailed you.'
            }
            footer={
                <Link href="/login" className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:underline">
                    <ArrowLeft className="h-4 w-4" aria-hidden /> Back to sign in
                </Link>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-5" aria-busy={isLoading}>
                {needsResend && !error && (
                    <FormAlert tone="info">
                        Your account is ready, but the first email could not be sent. Press <strong>Resend code</strong> below.
                    </FormAlert>
                )}
                {error && <FormAlert>{error}</FormAlert>}

                {!emailFromQuery && (
                    <TextField
                        label="Email" name="email" type="email" inputMode="email" autoComplete="email"
                        value={email} onChange={(e) => setEmail(e.target.value)} required
                    />
                )}
                <TextField
                    label="Verification code" name="code" autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false}
                    maxLength={8} placeholder="A1B2C3" autoFocus required
                    hint="The code expires after 15 minutes."
                    className="text-center font-mono text-lg uppercase tracking-[0.35em]"
                />

                <Button type="submit" size="lg" disabled={isLoading} className="h-11 w-full text-base">
                    {isLoading ? (<><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Verifying...</>) : 'Verify email'}
                </Button>

                <div className="text-center text-sm text-neutral-500">
                    Did not get it?{' '}
                    <button
                        type="button"
                        onClick={handleResend}
                        disabled={cooldown > 0}
                        className="font-semibold text-emerald-700 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-neutral-500 disabled:no-underline"
                    >
                        {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                    </button>
                </div>
            </form>
        </AuthShell>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={null}>
            <VerifyEmailContent />
        </Suspense>
    );
}
