'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
    const [step, setStep] = useState<1 | 2>(1);
    const [isLoading, setIsLoading] = useState(false);
    const [verifiedCode, setVerifiedCode] = useState('');

    const router = useRouter();
    const searchParams = useSearchParams();
    const emailFromQuery = searchParams.get('email') || '';

    // Step 1: Verify Code
    async function handleVerifyCode(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsLoading(true);

        const formData = new FormData(event.currentTarget);
        const code = formData.get('code') as string;
        const email = formData.get('email') as string;

        try {
            const response = await fetch('/api/auth/verify-reset-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Invalid code');
            }

            setVerifiedCode(code);
            setStep(2);
        } catch (error: any) {
            alert(error.message);
        } finally {
            setIsLoading(false);
        }
    }

    // Step 2: Reset Password
    async function handleResetPassword(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsLoading(true);

        const formData = new FormData(event.currentTarget);
        const newPassword = formData.get('newPassword') as string;
        const confirmPassword = formData.get('confirmPassword') as string;
        const email = formData.get('email') as string; // Hidden input

        if (newPassword !== confirmPassword) {
            alert('Passwords do not match');
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/auth/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code: verifiedCode, newPassword }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Reset failed');
            }

            alert('Password reset successfully! Please log in.');
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
                    <div className="h-12 w-12 bg-red-600 rounded-xl flex items-center justify-center text-white mb-4">
                        <Lock className="h-7 w-7" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
                    <CardDescription>
                        {step === 1 ? 'Enter the code sent to your email' : 'Create a new secure password'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {step === 1 ? (
                        <form onSubmit={handleVerifyCode} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    defaultValue={emailFromQuery}
                                    readOnly={!!emailFromQuery} // If email provided in URL, make it reasonably fixed
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="code">Reset Code</Label>
                                <Input
                                    id="code"
                                    name="code"
                                    type="text"
                                    placeholder="Enter 6-character code"
                                    className="text-center text-lg tracking-widest uppercase"
                                    required
                                />
                            </div>
                            <Button disabled={isLoading} className="w-full bg-red-600 hover:bg-red-700">
                                {isLoading ? 'Verifying...' : (
                                    <span className="flex items-center gap-2">Verify Code <ArrowRight className="w-4 h-4" /></span>
                                )}
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            <input type="hidden" name="email" value={emailFromQuery} />

                            <div className="space-y-2">
                                <Label htmlFor="newPassword">New Password</Label>
                                <Input
                                    id="newPassword"
                                    name="newPassword"
                                    type="password"
                                    placeholder="******"
                                    minLength={6}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm Password</Label>
                                <Input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    placeholder="******"
                                    minLength={6}
                                    required
                                />
                            </div>
                            <Button disabled={isLoading} className="w-full bg-green-600 hover:bg-green-700">
                                {isLoading ? 'Resetting...' : (
                                    <span className="flex items-center gap-2">Set New Password <CheckCircle2 className="w-4 h-4" /></span>
                                )}
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
