'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KeyRound } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsLoading(true);

        const formData = new FormData(event.currentTarget);
        const email = formData.get('email');

        try {
            const response = await fetch('/api/auth/forgot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            // Always say success to prevent email enumeration
            const data = await response.json();
            alert(data.message);
            router.push(`/reset-password?email=${encodeURIComponent(email as string)}`);

        } catch (error: any) {
            alert('Something went wrong. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 p-4">
            <Card className="w-full max-w-md shadow-lg border-neutral-200 dark:border-neutral-800">
                <CardHeader className="space-y-1 items-center text-center">
                    <div className="h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center text-white mb-4">
                        <KeyRound className="h-7 w-7" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Forgot Password</CardTitle>
                    <CardDescription>
                        Enter your email to receive a reset code
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
                                required
                            />
                        </div>
                        <Button disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700">
                            {isLoading ? 'Sending Code...' : 'Send Reset Code'}
                        </Button>
                        <div className="text-center text-sm">
                            <Link href="/login" className="text-blue-600 hover:underline">
                                Back to Login
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
