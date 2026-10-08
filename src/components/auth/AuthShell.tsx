import * as React from 'react';
import Link from 'next/link';
import { CalendarCheck, FileText, HeartPulse, Lock, Users } from 'lucide-react';

const POINTS = [
    { icon: CalendarCheck, title: 'Book in a few taps', text: 'Pick a doctor and a time, get your queue number.' },
    { icon: FileText, title: 'Everything in one place', text: 'Prescriptions, lab results and bills together.' },
    { icon: Users, title: 'Care for the whole family', text: 'Link a child or parent and switch between accounts.' },
];

interface AuthShellProps {
    title: string;
    subtitle?: React.ReactNode;
    children: React.ReactNode;
    /** Links under the form: "Already have an account? Sign in" */
    footer?: React.ReactNode;
}

/**
 * Frame for every sign-in / sign-up screen. On wide screens a brand panel explains what the product does;
 * on phones that panel collapses to a logo so the form is the first thing you see.
 */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
    return (
        <div className="grid min-h-screen lg:grid-cols-[5fr_6fr]">
            <aside className="relative hidden flex-col justify-between bg-emerald-900 p-12 text-white lg:flex" aria-hidden="false">
                <Link href="/" className="inline-flex w-fit items-center gap-3 rounded-lg">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                        <HeartPulse className="h-6 w-6" aria-hidden />
                    </span>
                    <span className="font-heading text-xl font-bold tracking-tight">Sethro Medical</span>
                </Link>

                <div className="max-w-md space-y-10">
                    <div className="space-y-4">
                        <h2 className="font-heading text-4xl font-bold leading-tight">Your care, organised.</h2>
                        <p className="text-lg text-emerald-100">
                            Appointments, prescriptions and results for patients, doctors, the lab and the pharmacy, on one platform.
                        </p>
                    </div>
                    <ul className="space-y-5">
                        {POINTS.map((p) => (
                            <li key={p.title} className="flex gap-4">
                                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 text-emerald-200 ring-1 ring-white/15">
                                    <p.icon className="h-5 w-5" aria-hidden />
                                </span>
                                <span>
                                    <span className="block font-semibold">{p.title}</span>
                                    <span className="block text-sm text-emerald-100">{p.text}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>

                <p className="flex items-center gap-2 text-sm text-emerald-100">
                    <Lock className="h-4 w-4" aria-hidden />
                    Your records are visible only to you and your care team.
                </p>
            </aside>

            <main id="main-content" tabIndex={-1} className="flex items-center justify-center bg-background px-4 py-10 outline-none sm:px-8">
                <div className="w-full max-w-md">
                    <Link href="/" className="mb-8 inline-flex items-center gap-2.5 rounded-lg lg:hidden">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
                            <HeartPulse className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="font-heading text-lg font-bold tracking-tight text-neutral-900">Sethro Medical</span>
                    </Link>

                    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-[var(--shadow-raised)] sm:p-8">
                        <div className="mb-6 space-y-1.5">
                            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">{title}</h1>
                            {subtitle && <p className="text-sm text-neutral-500">{subtitle}</p>}
                        </div>
                        {children}
                    </div>

                    {footer && <div className="mt-6 text-center text-sm text-neutral-500">{footer}</div>}
                </div>
            </main>
        </div>
    );
}
