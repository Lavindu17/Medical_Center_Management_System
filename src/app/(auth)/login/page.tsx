'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { HeartPulse } from 'lucide-react';

export default function LoginPage() {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsLoading(true);

        const formData = new FormData(event.currentTarget);
        const email = formData.get('email');
        const password = formData.get('password');

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }

            // Redirect based on role
            switch (data.user.role) {
                case 'ADMIN': router.push('/admin'); break;
                case 'DOCTOR': router.push('/doctor'); break;
                case 'PATIENT': router.push('/patient'); break;
                case 'PHARMACIST': router.push('/pharmacist'); break;
                case 'LAB_ASSISTANT': router.push('/lab-assistant'); break;
                case 'RECEPTIONIST': router.push('/receptionist'); break;
                default: router.push('/');
            }

        } catch (error: any) {
            alert(error.message); // Simple alert for now, can perform better toast later
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 p-4">
            <Card className="w-full max-w-md shadow-lg border-neutral-200 dark:border-neutral-800">
                <CardHeader className="space-y-1 items-center text-center">
                    <div className="h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center text-white mb-4">
                        <HeartPulse className="h-7 w-7" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
                    <CardDescription>
                        Sign in to your Sethro Medical account
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" name="email" type="email" placeholder="m@example.com" required />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Password</Label>
                                <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">
                                    Forgot password?
                                </Link>
                            </div>
                            <Input id="password" name="password" type="password" required />
                        </div>
                        <Button disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700">
                            {isLoading ? 'Signing In...' : 'Sign In'}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex flex-col gap-4 text-center">
                    <div className="text-sm text-neutral-500">
                        Don't have an account?{' '}
                        <Link href="/register" className="text-blue-600 hover:underline font-medium">
                            Create Patient Account
                        </Link>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
