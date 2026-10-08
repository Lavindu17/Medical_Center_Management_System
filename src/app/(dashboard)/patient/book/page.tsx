'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Search, Stethoscope } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, LoadingState } from '@/components/ui/state-views';
import { useAuth } from '@/context/AuthContext';
import { asDoctor, initialOf } from '@/lib/names';
import { formatDate, shortTime } from '@/lib/dates';
import { cn, formatLKR } from '@/lib/utils';

interface Doctor {
    id: number;
    name: string;
    specialization: string;
    consultationFee: number;
}

interface Slot {
    time: string;
    available: boolean;
}

const STEPS = ['Doctor', 'Date & time', 'Confirm'] as const;
const REASON_HINTS = ['Fever', 'Headache', 'Cough or cold', 'Stomach pain', 'Check-up', 'Follow-up visit'];
const DAYS_SHOWN = 14;

/** Local calendar day as YYYY-MM-DD (toISOString() would give the UTC day, which is wrong for part of the day in Sri Lanka). */
function dayString(date: Date) {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${mm}-${dd}`;
}

function upcomingDays() {
    return Array.from({ length: DAYS_SHOWN }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return {
            value: dayString(d),
            top: i === 0 ? 'Today' : i === 1 ? 'Tmrw' : d.toLocaleDateString('en-GB', { weekday: 'short' }),
            num: d.getDate(),
            month: d.toLocaleDateString('en-GB', { month: 'short' }),
        };
    });
}

export default function BookAppointmentPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [step, setStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);

    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [doctorsLoading, setDoctorsLoading] = useState(true);
    const [slots, setSlots] = useState<Slot[]>([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedSlot, setSelectedSlot] = useState('');
    const [reason, setReason] = useState('');

    const days = useMemo(upcomingDays, []);
    const today = days[0].value;
    const topRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetch('/api/doctors')
            .then(async (res) => {
                if (!res.ok) throw new Error();
                setDoctors(await res.json());
            })
            .catch(() => toast.error('Could not load the doctors. Please refresh and try again.'))
            .finally(() => setDoctorsLoading(false));
    }, []);

    const filteredDoctors = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return doctors;
        return doctors.filter((d) => d.name.toLowerCase().includes(q) || d.specialization.toLowerCase().includes(q));
    }, [doctors, searchQuery]);

    useEffect(() => {
        if (!selectedDoctor || !selectedDate) return;
        let cancelled = false;
        setSlotsLoading(true);
        setSlots([]);
        setSelectedSlot('');
        fetch(`/api/doctors/availability?doctorId=${selectedDoctor.id}&date=${selectedDate}`)
            .then(async (res) => {
                if (!res.ok) throw new Error();
                const data = await res.json();
                if (!cancelled) setSlots(data.slots ?? []);
            })
            .catch(() => { if (!cancelled) toast.error('Could not load the available times. Please try again.'); })
            .finally(() => { if (!cancelled) setSlotsLoading(false); });
        return () => { cancelled = true; };
    }, [selectedDoctor, selectedDate]);

    // Each step starts at the top of the screen, so a phone does not stay scrolled down the previous list
    function goTo(next: number) {
        setStep(next);
        topRef.current?.scrollIntoView({ block: 'start' });
    }

    async function submitBooking() {
        if (!user) {
            toast.error('You must be signed in to book.');
            return;
        }
        setSubmitting(true);
        const toastId = toast.loading('Booking your appointment…');
        try {
            const res = await fetch('/api/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patientId: user.id,
                    doctorId: selectedDoctor?.id,
                    date: selectedDate,
                    timeSlot: selectedSlot,
                    reason,
                }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) throw new Error(body?.message || 'Booking failed');

            toast.success('Appointment booked', { id: toastId, description: `Queue #${body.appointment.queueNumber}` });
            router.push(`/patient?success=true&queue=${body.appointment.queueNumber}`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Booking failed', { id: toastId });
            setSubmitting(false);
        }
    }

    const canContinue = step === 1 ? Boolean(selectedDoctor) : step === 2 ? Boolean(selectedDate && selectedSlot) : true;
    const summary = step === 1
        ? selectedDoctor ? asDoctor(selectedDoctor.name) : 'Choose a doctor to continue'
        : step === 2
            ? selectedSlot ? `${formatDate(selectedDate)} at ${shortTime(selectedSlot)}` : 'Choose a day and a time'
            : formatLKR(selectedDoctor?.consultationFee);

    return (
        <div ref={topRef} className="mx-auto max-w-3xl scroll-mt-20 space-y-5 pb-4">
            <PageHeader title="Book appointment" description="Three quick steps. You get a queue number straight away." />

            {/* Progress: a bar and the current step's name, instead of three pills that do not fit a phone */}
            <div aria-label={`Step ${step} of ${STEPS.length}`} role="group">
                <div className="mb-2 flex items-baseline justify-between text-sm">
                    <p className="font-semibold text-neutral-900">{STEPS[step - 1]}</p>
                    <p className="text-neutral-500">Step {step} of {STEPS.length}</p>
                </div>
                <div className="flex gap-1.5" aria-hidden>
                    {STEPS.map((_, i) => (
                        <span key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors', i < step ? 'bg-emerald-600' : 'bg-neutral-200')} />
                    ))}
                </div>
            </div>

            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.2 }}
                >
                    {step === 1 && (
                        <section aria-labelledby="doctor-heading" className="space-y-3">
                            <h2 id="doctor-heading" className="sr-only">Choose a doctor</h2>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" aria-hidden />
                                <Input
                                    type="search"
                                    aria-label="Search doctors by name or speciality"
                                    placeholder="Search by name or speciality"
                                    className="h-12 pl-10 text-base"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            {doctorsLoading ? (
                                <LoadingState label="Loading doctors…" />
                            ) : filteredDoctors.length === 0 ? (
                                <EmptyState
                                    icon={Stethoscope}
                                    title={searchQuery ? 'No doctor matches your search' : 'No doctors available right now'}
                                    description={searchQuery ? 'Try a different name or speciality.' : 'Please check back later.'}
                                />
                            ) : (
                                <ul className="space-y-2.5">
                                    {filteredDoctors.map((doc) => {
                                        const selected = selectedDoctor?.id === doc.id;
                                        return (
                                            <li key={doc.id}>
                                                <button
                                                    type="button"
                                                    aria-pressed={selected}
                                                    onClick={() => setSelectedDoctor(doc)}
                                                    className={cn(
                                                        'flex min-h-20 w-full items-center gap-3.5 rounded-xl border bg-white p-3.5 text-left shadow-[var(--shadow-card)] transition-colors active:bg-neutral-50',
                                                        selected ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600' : 'border-neutral-200 hover:border-emerald-400',
                                                    )}
                                                >
                                                    <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-800" aria-hidden>
                                                        {initialOf(doc.name)}
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate font-semibold text-neutral-900">{asDoctor(doc.name)}</span>
                                                        <span className="block truncate text-sm text-neutral-600">{doc.specialization}</span>
                                                        <span className="mt-0.5 block text-sm font-medium text-neutral-800">{formatLKR(doc.consultationFee)} <span className="font-normal text-neutral-500">per visit</span></span>
                                                    </span>
                                                    <span
                                                        className={cn('flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2', selected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-neutral-300')}
                                                        aria-hidden
                                                    >
                                                        {selected && <CheckCircle2 className="h-4 w-4" />}
                                                    </span>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>
                    )}

                    {step === 2 && (
                        <section aria-labelledby="when-heading" className="space-y-5">
                            <div>
                                <h2 id="when-heading" className="text-lg font-semibold text-neutral-900">When would you like to see {asDoctor(selectedDoctor?.name)}?</h2>
                            </div>

                            <div className="space-y-2">
                                <p className="text-sm font-medium text-neutral-800" id="day-label">Day</p>
                                <div
                                    role="group"
                                    aria-labelledby="day-label"
                                    className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0"
                                >
                                    {days.map((d) => {
                                        const selected = selectedDate === d.value;
                                        return (
                                            <button
                                                key={d.value}
                                                type="button"
                                                aria-pressed={selected}
                                                onClick={() => setSelectedDate(d.value)}
                                                className={cn(
                                                    'flex h-[72px] w-16 flex-shrink-0 snap-start flex-col items-center justify-center rounded-xl border text-center transition-colors',
                                                    selected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-neutral-200 bg-white text-neutral-800 active:bg-neutral-50',
                                                )}
                                            >
                                                <span className={cn('text-[11px] font-semibold uppercase', selected ? 'text-emerald-100' : 'text-neutral-500')}>{d.top}</span>
                                                <span className="text-xl font-bold leading-tight">{d.num}</span>
                                                <span className={cn('text-[11px]', selected ? 'text-emerald-100' : 'text-neutral-500')}>{d.month}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                    <Label htmlFor="other-date" className="flex items-center gap-1.5 text-sm font-normal text-neutral-600">
                                        <CalendarDays className="h-4 w-4" aria-hidden /> Another date
                                    </Label>
                                    <Input
                                        id="other-date"
                                        type="date"
                                        min={today}
                                        value={selectedDate}
                                        onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                                        className="h-11 w-auto text-base"
                                    />
                                </div>
                            </div>

                            {selectedDate && (
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-neutral-800" id="time-label">Time on {formatDate(selectedDate)}</p>
                                    {slotsLoading ? (
                                        <LoadingState label="Checking available times…" />
                                    ) : slots.length === 0 ? (
                                        <EmptyState
                                            icon={CalendarDays}
                                            title="No times available on this day"
                                            description="The doctor may be away or fully booked. Try another day."
                                        />
                                    ) : (
                                        <>
                                            <div role="group" aria-labelledby="time-label" className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                                                {slots.map((slot) => {
                                                    const selected = selectedSlot === slot.time;
                                                    return (
                                                        <button
                                                            key={slot.time}
                                                            type="button"
                                                            disabled={!slot.available}
                                                            aria-pressed={selected}
                                                            onClick={() => setSelectedSlot(slot.time)}
                                                            className={cn(
                                                                'h-12 rounded-lg border text-base font-semibold tabular transition-colors',
                                                                !slot.available
                                                                    ? 'cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-500 line-through'
                                                                    : selected
                                                                        ? 'border-emerald-600 bg-emerald-600 text-white'
                                                                        : 'border-neutral-300 bg-white text-neutral-900 active:bg-emerald-50',
                                                            )}
                                                        >
                                                            {shortTime(slot.time)}
                                                            {!slot.available && <span className="sr-only"> (already booked)</span>}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-xs text-neutral-500">Crossed-out times are already booked.</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </section>
                    )}

                    {step === 3 && (
                        <section aria-labelledby="confirm-heading" className="space-y-5">
                            <h2 id="confirm-heading" className="text-lg font-semibold text-neutral-900">Check and confirm</h2>

                            <dl className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white text-sm shadow-[var(--shadow-card)]">
                                {[
                                    ['Doctor', asDoctor(selectedDoctor?.name)],
                                    ['Speciality', selectedDoctor?.specialization],
                                    ['Date', formatDate(selectedDate)],
                                    ['Time', shortTime(selectedSlot)],
                                ].map(([label, value]) => (
                                    <div key={label} className="flex items-center justify-between gap-4 px-4 py-3">
                                        <dt className="text-neutral-600">{label}</dt>
                                        <dd className="text-right font-semibold text-neutral-900">{value}</dd>
                                    </div>
                                ))}
                                <div className="flex items-center justify-between gap-4 bg-emerald-50 px-4 py-3">
                                    <dt className="font-medium text-emerald-900">Consultation fee</dt>
                                    <dd className="text-base font-bold text-emerald-900">{formatLKR(selectedDoctor?.consultationFee)}</dd>
                                </div>
                            </dl>

                            <div className="space-y-2">
                                <Label htmlFor="reason" className="text-sm font-medium text-neutral-800">
                                    Reason for the visit <span className="font-normal text-neutral-500">(optional)</span>
                                </Label>
                                <div className="flex flex-wrap gap-2">
                                    {REASON_HINTS.map((hint) => (
                                        <button
                                            key={hint}
                                            type="button"
                                            onClick={() => setReason((r) => (r.toLowerCase().includes(hint.toLowerCase()) ? r : r ? `${r}, ${hint.toLowerCase()}` : hint))}
                                            className="min-h-10 rounded-full border border-neutral-300 bg-white px-3.5 text-sm text-neutral-800 active:bg-emerald-50"
                                        >
                                            {hint}
                                        </button>
                                    ))}
                                </div>
                                <textarea
                                    id="reason"
                                    rows={3}
                                    maxLength={500}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Describe your symptoms in your own words"
                                    className="flex min-h-24 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base placeholder:text-neutral-500 focus-visible:border-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
                                />
                            </div>
                        </section>
                    )}
                </motion.div>
            </AnimatePresence>

            {/* The primary action stays at the bottom of the screen, under the thumb, however long the list above is */}
            <div className="sticky bottom-0 z-30 -mx-4 border-t border-neutral-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:mx-0 md:rounded-xl md:border md:pb-3">
                <p className="mb-2 truncate text-sm text-neutral-600" aria-live="polite">{summary}</p>
                <div className="flex gap-2">
                    {step > 1 && (
                        <Button type="button" variant="outline" className="h-12 flex-shrink-0 px-4" onClick={() => goTo(step - 1)} disabled={submitting}>
                            <ChevronLeft className="h-4 w-4" aria-hidden /> Back
                        </Button>
                    )}
                    {step < 3 ? (
                        <Button type="button" className="h-12 flex-1 text-base" disabled={!canContinue} onClick={() => goTo(step + 1)}>
                            Continue <ChevronRight className="h-4 w-4" aria-hidden />
                        </Button>
                    ) : (
                        <Button type="button" className="h-12 flex-1 text-base" disabled={submitting} onClick={submitBooking}>
                            <CheckCircle2 className="h-4 w-4" aria-hidden /> {submitting ? 'Booking…' : 'Confirm booking'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
