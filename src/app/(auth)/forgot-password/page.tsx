'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormAlert, TextField } from '@/components/ui/text-field';
import { AuthShell } from '@/components/auth/AuthShell';

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsLoading(true);
        setError(null);

        const email = String(new FormData(event.currentTarget).get('email') ?? '').trim();

        try {
            const response = await fetch('/api/auth/forgot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            if (response.status === 429) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || 'Too many requests. Please wait a while and try again.');
            }
            if (!response.ok) throw new Error('Please enter a valid email address.');

            // The server answers the same whether or not the address has an account, so we do too.
            router.push(`/reset-password?email=${encodeURIComponent(email)}&sent=1`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
            setIsLoading(false);
        }
    }

    return (
        <AuthShell
            title="Forgot your password?"
            subtitle="Enter your email and we'll send a 6-character code to reset it."
            footer={
                <Link href="/login" className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:underline">
                    <ArrowLeft className="h-4 w-4" aria-hidden /> Back to sign in
                </Link>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-5" aria-busy={isLoading}>
                {error && <FormAlert>{error}</FormAlert>}
                <TextField
                    label="Email" name="email" type="email" inputMode="email" autoComplete="email"
                    placeholder="you@example.com" autoFocus required
                />
                <Button type="submit" size="lg" disabled={isLoading} className="h-11 w-full text-base">
                    {isLoading ? (<><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Sending code...</>) : 'Send reset code'}
                </Button>
            </form>
        </AuthShell>
    );
}
