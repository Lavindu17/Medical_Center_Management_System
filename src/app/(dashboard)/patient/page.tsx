'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowRight, CalendarCheck, CalendarClock, CalendarX, CheckCircle2, Clock, CreditCard, FileText, Pill, Plus, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState } from '@/components/ui/state-views';
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/context/AuthContext';
import { asDoctor } from '@/lib/names';
import { daysFromToday, firstName, friendlyDay, greeting, parseDay, shortTime } from '@/lib/dates';

interface Appointment {
    id: number;
    date: string;
    timeSlot: string;
    queueNumber: number;
    status: string;
    doctorName: string;
    specialization: string;
}

const CANCELLABLE = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'ARRIVED'];
const IN_PROGRESS = ['CHECKED_IN', 'ARRIVED', 'ONGOING'];

const QUICK_ACTIONS = [
    { href: '/patient/book', label: 'Book a visit', hint: 'Pick a doctor and time', icon: CalendarCheck },
    { href: '/patient/prescriptions', label: 'Prescriptions', hint: 'Your medicines', icon: Pill },
    { href: '/patient/labs', label: 'Lab reports', hint: 'Results and files', icon: FileText },
    { href: '/patient/billing', label: 'Bills', hint: 'Charges and payments', icon: CreditCard },
];

/** The booking flow sends people back here with ?success=true&queue=N: confirm it, then let it be dismissed. */
function BookingConfirmation() {
    const router = useRouter();
    const params = useSearchParams();
    const queue = params.get('queue');
    if (params.get('success') !== 'true') return null;
    return (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-700" aria-hidden />
            <div className="flex-1 text-sm">
                <p className="font-semibold">Your appointment is booked.</p>
                {queue && <p className="mt-0.5">Your queue number is <strong>#{queue}</strong>. Show it at the front desk when you arrive.</p>}
            </div>
            <button
                type="button"
                onClick={() => router.replace('/patient', { scroll: false })}
                className="-m-1 flex h-9 w-9 items-center justify-center rounded-md text-emerald-800 hover:bg-emerald-100"
                aria-label="Dismiss"
            >
                <X className="h-4 w-4" aria-hidden />
            </button>
        </div>
    );
}

function NextVisit({ appointment, onCancel }: { appointment: Appointment; onCancel: (a: Appointment) => void }) {
    const diff = daysFromToday(appointment.date);
    const when = friendlyDay(appointment.date);
    const active = IN_PROGRESS.includes(appointment.status);

    return (
        <section aria-labelledby="next-visit-heading" className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between gap-3 bg-emerald-800 px-5 py-3 text-white">
                <h2 id="next-visit-heading" className="text-sm font-semibold uppercase tracking-wider text-emerald-100">
                    {active ? 'Your visit is underway' : 'Your next visit'}
                </h2>
                <StatusBadge status={appointment.status} size="sm" className="border-transparent" />
            </div>

            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-3">
                    <div>
                        <p className="text-xl font-bold text-neutral-900">{asDoctor(appointment.doctorName)}</p>
                        <p className="text-sm text-neutral-500">{appointment.specialization}</p>
                    </div>
                    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-700">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-neutral-900">
                            <CalendarClock className="h-4 w-4 text-emerald-700" aria-hidden />
                            {when}{diff > 1 && diff <= 14 ? <span className="font-normal text-neutral-500"> (in {diff} days)</span> : null}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-emerald-700" aria-hidden />
                            {shortTime(appointment.timeSlot)}
                        </span>
                    </p>
                </div>

                <div className="flex items-center gap-5">
                    <div className="rounded-xl bg-emerald-50 px-5 py-3 text-center" aria-label={`Queue number ${appointment.queueNumber}`}>
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-800">Queue</p>
                        <p className="text-3xl font-bold leading-none text-emerald-800 tabular">#{appointment.queueNumber}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Button asChild variant="outline" size="sm">
                            <Link href={`/patient/appointments/${appointment.id}`}>View details</Link>
                        </Button>
                        {CANCELLABLE.includes(appointment.status) && (
                            <Button variant="ghost" size="sm" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => onCancel(appointment)}>
                                Cancel visit
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

function VisitRow({ appointment, onCancel }: { appointment: Appointment; onCancel?: (a: Appointment) => void }) {
    return (
        <li className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <Link href={`/patient/appointments/${appointment.id}`} className="min-w-0 flex-1 rounded-md hover:text-emerald-800">
                <p className="truncate font-semibold text-neutral-900">{asDoctor(appointment.doctorName)}</p>
                <p className="mt-0.5 text-sm text-neutral-500">
                    {friendlyDay(appointment.date)} at {shortTime(appointment.timeSlot)}
                    <span className="mx-1.5" aria-hidden>·</span>
                    {appointment.specialization}
                </p>
            </Link>
            <div className="flex items-center gap-3">
                <StatusBadge status={appointment.status} size="sm" />
                {onCancel && CANCELLABLE.includes(appointment.status) && (
                    <Button variant="ghost" size="sm" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => onCancel(appointment)}>
                        Cancel
                    </Button>
                )}
            </div>
        </li>
    );
}

export default function PatientDashboard() {
    const { user } = useAuth();
    const confirm = useConfirm();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [failed, setFailed] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/appointments', { cache: 'no-store' });
            if (!res.ok) throw new Error('bad response');
            setAppointments(await res.json());
            setFailed(false);
        } catch {
            setFailed(true);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(load, 0);
        return () => clearTimeout(timer);
    }, [load]);

    const { upcoming, history, completedCount, cancelledCount } = useMemo(() => {
        const live = appointments.filter((a) => a.status !== 'CANCELLED' && a.status !== 'COMPLETED' && a.status !== 'ABSENT' && a.status !== 'NO_SHOW' && daysFromToday(a.date) >= 0);
        live.sort((a, b) => parseDay(a.date).getTime() - parseDay(b.date).getTime() || a.timeSlot.localeCompare(b.timeSlot));
        const rest = appointments.filter((a) => !live.includes(a));
        rest.sort((a, b) => parseDay(b.date).getTime() - parseDay(a.date).getTime());
        return {
            upcoming: live,
            history: rest,
            completedCount: appointments.filter((a) => a.status === 'COMPLETED').length,
            cancelledCount: appointments.filter((a) => a.status === 'CANCELLED').length,
        };
    }, [appointments]);

    async function cancel(appointment: Appointment) {
        const ok = await confirm({
            title: 'Cancel this appointment?',
            description: `${asDoctor(appointment.doctorName)}, ${friendlyDay(appointment.date)} at ${shortTime(appointment.timeSlot)}. The time slot will be offered to other patients.`,
            confirmLabel: 'Cancel appointment',
            cancelLabel: 'Keep appointment',
            destructive: true,
        });
        if (!ok) return;

        const res = await fetch('/api/appointments/cancel', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appointmentId: appointment.id }),
        });
        if (res.ok) {
            toast.success('Appointment cancelled');
            load();
        } else {
            toast.error((await res.json().catch(() => null))?.message || 'Could not cancel this appointment.');
        }
    }

    const next = upcoming[0];
    const laterVisits = upcoming.slice(1);
    const name = firstName(user?.name);

    return (
        <div className="space-y-8">
            <PageHeader
                title={name ? `${greeting()}, ${name}` : greeting()}
                description="Here is what is coming up and where to find your records."
                actions={
                    <Button asChild size="lg" className="gap-2">
                        <Link href="/patient/book"><Plus className="h-4 w-4" aria-hidden /> Book appointment</Link>
                    </Button>
                }
            />

            <Suspense fallback={null}><BookingConfirmation /></Suspense>

            {isLoading ? (
                <div className="space-y-4" aria-busy="true" aria-label="Loading your appointments">
                    <Skeleton className="h-44 w-full rounded-2xl" />
                    <div className="grid grid-cols-3 gap-3">
                        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
                    </div>
                    <SkeletonCard lines={3} />
                </div>
            ) : failed ? (
                <ErrorState title="We couldn't load your appointments" onRetry={load} />
            ) : (
                <>
                    {next ? (
                        <NextVisit appointment={next} onCancel={cancel} />
                    ) : (
                        <EmptyState
                            icon={CalendarX}
                            title="No upcoming appointments"
                            description="Book a visit with one of our doctors. You will get a queue number straight away."
                            action={{ label: 'Book an appointment', href: '/patient/book' }}
                        />
                    )}

                    <section aria-label="Overview" className="grid grid-cols-3 gap-3">
                        <StatCard label="Upcoming" value={upcoming.length} icon={CalendarClock} tone="brand" href="/patient/appointments" />
                        <StatCard label="Completed" value={completedCount} icon={CheckCircle2} tone="info" />
                        <StatCard label="Cancelled" value={cancelledCount} icon={CalendarX} tone="neutral" />
                    </section>

                    <section aria-labelledby="quick-heading" className="space-y-3">
                        <h2 id="quick-heading" className="text-base font-semibold text-neutral-900">Quick actions</h2>
                        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                            {QUICK_ACTIONS.map(({ href, label, hint, icon: Icon }) => (
                                <li key={href}>
                                    <Link
                                        href={href}
                                        className="group flex h-full min-h-[88px] items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-[var(--shadow-card)] transition-all hover:border-emerald-300 hover:shadow-[var(--shadow-raised)]"
                                    >
                                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 transition-colors group-hover:bg-emerald-100">
                                            <Icon className="h-5 w-5" aria-hidden />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block font-semibold text-neutral-900">{label}</span>
                                            <span className="block text-xs text-neutral-500">{hint}</span>
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>

                    {laterVisits.length > 0 && (
                        <section aria-labelledby="later-heading" className="space-y-3">
                            <h2 id="later-heading" className="text-base font-semibold text-neutral-900">Also coming up</h2>
                            <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[var(--shadow-card)]">
                                {laterVisits.map((a) => <VisitRow key={a.id} appointment={a} onCancel={cancel} />)}
                            </ul>
                        </section>
                    )}

                    {history.length > 0 && (
                        <section aria-labelledby="history-heading" className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 id="history-heading" className="text-base font-semibold text-neutral-900">Recent history</h2>
                                <Link href="/patient/appointments" className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline">
                                    View all <ArrowRight className="h-4 w-4" aria-hidden />
                                </Link>
                            </div>
                            <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[var(--shadow-card)]">
                                {history.slice(0, 5).map((a) => <VisitRow key={a.id} appointment={a} />)}
                            </ul>
                        </section>
                    )}
                </>
            )}
        </div>
    );
}
