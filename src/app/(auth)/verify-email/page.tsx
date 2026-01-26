'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';

export default function VerifyEmailPage() {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const emailFromQuery = searchParams.get('email') || '';

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsLoading(true);

        const formData = new FormData(event.currentTarget);
        const code = formData.get('code');
        const email = formData.get('email');

        try {
            const response = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Verification failed');
            }

            alert('Email verified successfully! Please sign in.');
            router.push('/login');

        } catch (error: any) {
            alert(error.message);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 p-4">
            <Card className="w-full max-w-md shadow-lg border-neutral-200 dark:border-neutral-800">
                <CardHeader className="space-y-1 items-center text-center">
                    <div className="h-12 w-12 bg-green-600 rounded-xl flex items-center justify-center text-white mb-4">
                        <ShieldCheck className="h-7 w-7" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Verify Email</CardTitle>
                    <CardDescription>
                        Enter the verification code sent to your email
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="name@example.com"
                                defaultValue={emailFromQuery}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="code">Verification Code</Label>
                            <Input
                                id="code"
                                name="code"
                                type="text"
                                placeholder="Enter code"
                                className="text-center text-lg tracking-widest uppercase"
                                required
                            />
                        </div>
                        <Button disabled={isLoading} className="w-full bg-green-600 hover:bg-green-700">
                            {isLoading ? 'Verifying...' : 'Verify Email'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
