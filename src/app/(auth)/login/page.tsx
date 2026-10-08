'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormAlert, PasswordField, TextField } from '@/components/ui/text-field';
import { AuthShell } from '@/components/auth/AuthShell';

const HOME_BY_ROLE: Record<string, string> = {
    ADMIN: '/admin',
    DOCTOR: '/doctor',
    PATIENT: '/patient',
    PHARMACIST: '/pharmacist',
    LAB_ASSISTANT: '/lab-assistant',
    RECEPTIONIST: '/receptionist',
};

const NOTICES: Record<string, string> = {
    verified: 'Your email is verified. You can sign in now.',
    reset: 'Your password was changed. Sign in with the new one.',
};

function LoginForm() {
    const router = useRouter();
    const params = useSearchParams();
    const notice = NOTICES[params.get('notice') ?? ''];

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsLoading(true);
        setError(null);
        setUnverifiedEmail(null);

        const formData = new FormData(event.currentTarget);
        const email = String(formData.get('email') ?? '').trim();
        const password = formData.get('password');

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                if (response.status === 403) setUnverifiedEmail(email);
                throw new Error(data.message || 'Sign-in failed. Please try again.');
            }

            router.push(HOME_BY_ROLE[data.user.role] ?? '/');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
            setIsLoading(false);
        }
        // On success the page navigates away, so the button stays in its busy state until then
    }

    return (
        <AuthShell
            title="Welcome back"
            subtitle="Sign in to your Sethro Medical account"
            footer={
                <>
                    New here?{' '}
                    <Link href="/register" className="font-semibold text-emerald-700 hover:underline">Create a patient account</Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-5" aria-busy={isLoading}>
                {notice && !error && <FormAlert tone="success">{notice}</FormAlert>}
                {error && (
                    <FormAlert>
                        <p className="font-medium">{error}</p>
                        {unverifiedEmail && (
                            <p className="mt-1">
                                <Link
                                    href={`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`}
                                    className="font-semibold underline underline-offset-2"
                                >
                                    Verify your email
                                </Link>{' '}
                                to finish setting up your account.
                            </p>
                        )}
                    </FormAlert>
                )}

                <TextField
                    label="Email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    inputMode="email"
                    placeholder="you@example.com"
                    autoFocus
                    required
                />
                <PasswordField
                    label="Password"
                    name="password"
                    autoComplete="current-password"
                    required
                    labelAction={
                        <Link href="/forgot-password" className="text-sm font-medium text-emerald-700 hover:underline">
                            Forgot password?
                        </Link>
                    }
                />

                <Button type="submit" size="lg" disabled={isLoading} className="h-11 w-full text-base">
                    {isLoading ? (<><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Signing in...</>) : 'Sign in'}
                </Button>
            </form>
        </AuthShell>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginForm />
        </Suspense>
    );
}
