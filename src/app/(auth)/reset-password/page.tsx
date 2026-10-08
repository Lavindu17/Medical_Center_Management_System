'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormAlert, PasswordField, TextField } from '@/components/ui/text-field';
import { AuthShell } from '@/components/auth/AuthShell';
import { cn } from '@/lib/utils';

function StepIndicator({ step }: { step: 1 | 2 }) {
    return (
        <ol className="mb-6 flex items-center gap-2 text-xs font-semibold" aria-label="Progress">
            {['Enter code', 'New password'].map((label, i) => {
                const n = (i + 1) as 1 | 2;
                const done = step > n;
                const current = step === n;
                return (
                    <li key={label} className="flex flex-1 items-center gap-2" aria-current={current ? 'step' : undefined}>
                        <span className={cn(
                            'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px]',
                            done || current ? 'bg-emerald-600 text-white' : 'bg-neutral-200 text-neutral-600',
                        )}>
                            {done ? '✓' : n}
                        </span>
                        <span className={cn(current ? 'text-neutral-900' : 'text-neutral-500')}>{label}</span>
                        {n === 1 && <span className={cn('h-px flex-1', step > 1 ? 'bg-emerald-600' : 'bg-neutral-200')} aria-hidden />}
                    </li>
                );
            })}
        </ol>
    );
}

function ResetPasswordContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const emailFromQuery = searchParams.get('email') || '';
    const codeFromQuery = searchParams.get('code') || '';
    const justSent = searchParams.get('sent') === '1';

    // A code in the link (from the email) skips straight to choosing a new password
    const [step, setStep] = useState<1 | 2>(codeFromQuery ? 2 : 1);
    const [isLoading, setIsLoading] = useState(false);
    const [verifiedCode, setVerifiedCode] = useState(codeFromQuery);
    const [error, setError] = useState<string | null>(null);
    const [mismatch, setMismatch] = useState<string | null>(null);

    async function handleVerifyCode(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsLoading(true);
        setError(null);

        const formData = new FormData(event.currentTarget);
        const code = String(formData.get('code') ?? '').trim();
        const email = String(formData.get('email') ?? '').trim();

        try {
            const response = await fetch('/api/auth/verify-reset-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || 'That code is not valid.');

            setVerifiedCode(code);
            setStep(2);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'That code is not valid.');
        } finally {
            setIsLoading(false);
        }
    }

    async function handleResetPassword(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        const formData = new FormData(event.currentTarget);
        const newPassword = String(formData.get('newPassword') ?? '');
        const confirmPassword = String(formData.get('confirmPassword') ?? '');

        if (newPassword !== confirmPassword) {
            setMismatch('The two passwords do not match.');
            return;
        }
        setMismatch(null);
        setIsLoading(true);

        try {
            const response = await fetch('/api/auth/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: emailFromQuery, code: verifiedCode, newPassword }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || 'This reset link has expired. Please request a new code.');

            router.push('/login?notice=reset');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
            setIsLoading(false);
        }
    }

    return (
        <AuthShell
            title={step === 1 ? 'Enter your reset code' : 'Choose a new password'}
            subtitle={step === 1
                ? 'Type the 6-character code we emailed you.'
                : 'Pick something you do not use anywhere else.'}
            footer={
                <Link href={step === 1 ? '/forgot-password' : '/login'} className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:underline">
                    <ArrowLeft className="h-4 w-4" aria-hidden /> {step === 1 ? 'Request a new code' : 'Back to sign in'}
                </Link>
            }
        >
            <StepIndicator step={step} />

            {step === 1 ? (
                <form onSubmit={handleVerifyCode} className="space-y-5" aria-busy={isLoading}>
                    {justSent && !error && (
                        <FormAlert tone="info">
                            If an account exists for <strong>{emailFromQuery || 'that address'}</strong>, a code is on its way. It expires in 15 minutes.
                        </FormAlert>
                    )}
                    {error && <FormAlert>{error}</FormAlert>}

                    <TextField
                        label="Email" name="email" type="email" inputMode="email" autoComplete="email"
                        defaultValue={emailFromQuery} readOnly={!!emailFromQuery} required
                    />
                    <TextField
                        label="Reset code" name="code" autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false}
                        maxLength={8} placeholder="A1B2C3" autoFocus required
                        className="text-center font-mono text-lg uppercase tracking-[0.35em]"
                    />
                    <Button type="submit" size="lg" disabled={isLoading} className="h-11 w-full text-base">
                        {isLoading ? (<><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking...</>) : 'Continue'}
                    </Button>
                </form>
            ) : (
                <form onSubmit={handleResetPassword} className="space-y-5" aria-busy={isLoading}>
                    {error && <FormAlert>{error}</FormAlert>}
                    <PasswordField
                        label="New password" name="newPassword" autoComplete="new-password" minLength={6} autoFocus required
                        hint="At least 6 characters."
                    />
                    <PasswordField
                        label="Confirm new password" name="confirmPassword" autoComplete="new-password" minLength={6} required
                        error={mismatch} onChange={() => mismatch && setMismatch(null)}
                    />
                    <Button type="submit" size="lg" disabled={isLoading} className="h-11 w-full text-base">
                        {isLoading ? (<><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving...</>) : 'Set new password'}
                    </Button>
                </form>
            )}
        </AuthShell>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={null}>
            <ResetPasswordContent />
        </Suspense>
    );
}
