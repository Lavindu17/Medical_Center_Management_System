'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, CalendarPlus, ChevronLeft, ChevronRight, Clock, LogIn, LogOut, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state-views';
import { FormAlert } from '@/components/ui/text-field';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { sendJson, useApi } from '@/hooks/useApi';
import { clockText, dayText, minutesText, monthText, shiftMonth, shiftText } from '@/lib/hr-format';
import { formatDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

interface TodayData {
    timezone: string; graceMinutes: number; today: string; todayStatus: string;
    todayShifts: { id: number; start: string; end: string; label: string | null }[];
    yesterdayShifts: { id: number; start: string; end: string; label: string | null }[];
    open: { recordId: number; since: string; shiftId: number | null } | null;
    punchesToday: { id: number; clockIn: string; clockOut: string | null }[];
    holidayName: string | null; leaveType: string | null;
    upcomingShifts: { id: number; date: string; start: string; end: string; label: string | null }[];
}

interface DayRow {
    day: string; status: string; workedMinutes: number; lateMinutes: number; earlyLeaveMinutes: number; extraMinutes: number; unscheduled: boolean;
    holidayName: string | null; leaveType: string | null;
    shifts: { id: number; start: string; end: string; label: string | null }[];
    punches: { id: number; clockIn: string; clockOut: string | null; source: string }[];
}

interface AttendanceData {
    timezone: string; month: string; today: string; days: DayRow[];
    summary: { presentDays: number; lateDays: number; absentDays: number; leaveDays: number; workedMinutes: number; extraMinutes: number; scheduledMinutes: number; incompleteDays: number };
}

interface LeaveData {
    year: number;
    balances: { typeId: number; code: string; name: string; unlimited: boolean; allowsHalfDay: boolean; entitled: number; used: number; pending: number; remaining: number }[];
    requests: { id: number; typeName: string; start: string; end: string; dayPart: string; days: number; reason: string | null; status: string; decisionNote: string | null; decidedByName: string | null }[];
}

interface CorrectionRow { id: number; workDate: string; clockIn: string; clockOut: string | null; reason: string; status: string; decisionNote: string | null }

/** Elapsed time since an instant, refreshed every 20 seconds. */
function useElapsed(since: string | null) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!since) return;
        const t = setInterval(() => setNow(Date.now()), 20_000);
        return () => clearInterval(t);
    }, [since]);
    return since ? Math.max(0, Math.round((now - new Date(since).getTime()) / 60_000)) : 0;
}

// ------------------------------------------------------------------------------------------------------ Today

function TodayTab() {
    const today = useApi<TodayData>('/api/hr/me/today');
    const month = useApi<AttendanceData>('/api/hr/me/attendance');
    const leave = useApi<LeaveData>('/api/hr/me/leave');
    const [busy, setBusy] = useState(false);
    const elapsed = useElapsed(today.data?.open?.since ?? null);

    async function clock(action: 'IN' | 'OUT') {
        setBusy(true);
        try {
            const r = await sendJson<{ lateMinutes?: number; unscheduled?: boolean; early?: boolean; workedMinutes?: number }>('/api/hr/me/clock', 'POST', { action });
            if (action === 'IN') {
                const notes = [r.unscheduled ? 'no shift matched, so this is marked unscheduled' : '', r.lateMinutes ? `${minutesText(r.lateMinutes)} late` : '', r.early ? 'before your shift' : ''].filter(Boolean);
                toast.success('Clocked in', { description: notes.join(', ') || undefined });
            } else {
                toast.success('Clocked out', { description: r.workedMinutes !== undefined ? `You worked ${minutesText(r.workedMinutes)} this session.` : undefined });
            }
            today.reload(); month.reload();
        } catch (e) {
            toast.error((e as Error).message);
        } finally {
            setBusy(false);
        }
    }

    if (today.loading && !today.data) return <LoadingState label="Loading your day…" />;
    if (today.error || !today.data) return <ErrorState title="Could not load your day" description={today.error ?? undefined} onRetry={today.reload} />;
    const d = today.data;
    const tz = d.timezone;
    const shifts = [...d.yesterdayShifts.filter((s) => s.end < s.start), ...d.todayShifts];   // an overnight shift from yesterday may still be running
    const s = month.data?.summary;
    const annual = leave.data?.balances ?? [];

    return (
        <div className="space-y-6">
            <section aria-labelledby="clock-heading" className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-[var(--shadow-card)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 id="clock-heading" className="text-sm font-semibold uppercase tracking-wider text-emerald-900">Today, {dayText(d.today)}</h2>
                    <StatusBadge status={d.open ? 'PRESENT' : d.todayStatus} kind="attendance" size="sm" />
                </div>

                {d.open ? (
                    <p className="mt-3 text-3xl font-bold tracking-tight text-neutral-900 tabular">
                        {minutesText(elapsed)} <span className="text-base font-medium text-neutral-600">since {clockText(d.open.since, tz)}</span>
                    </p>
                ) : (
                    <p className="mt-3 text-lg font-semibold text-neutral-900">
                        {d.leaveType ? `You are on ${d.leaveType.toLowerCase()} today` : d.holidayName ? `Public holiday: ${d.holidayName}` : shifts.length === 0 ? 'No shift today' : 'Not clocked in'}
                    </p>
                )}

                <ul className="mt-2 space-y-1 text-sm text-neutral-700" aria-label="Today's shifts">
                    {shifts.map((sh) => (
                        <li key={sh.id} className="flex items-center gap-2"><Clock className="h-4 w-4 text-emerald-700" aria-hidden /> {shiftText(sh)}{sh.label ? ` · ${sh.label}` : ''}</li>
                    ))}
                    {shifts.length === 0 && <li className="text-neutral-600">You can still clock in. It will be marked as unscheduled so HR can see it.</li>}
                </ul>

                <Button
                    type="button" size="lg" disabled={busy}
                    onClick={() => clock(d.open ? 'OUT' : 'IN')}
                    className={cn('mt-5 h-14 w-full gap-2 text-base font-bold', d.open ? 'bg-neutral-900 hover:bg-neutral-800' : '')}
                >
                    {d.open ? <><LogOut className="h-5 w-5" aria-hidden /> Clock out</> : <><LogIn className="h-5 w-5" aria-hidden /> Clock in</>}
                </Button>
                <p className="mt-2 text-xs text-neutral-500">The time is taken from the clinic's server, not your phone.</p>
            </section>

            <section aria-label="This month" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard compact label="Days present" value={s?.presentDays ?? '-'} hint={s ? `${s.lateDays} late` : undefined} icon={Clock} />
                <StatCard compact label="Hours worked" value={s ? minutesText(s.workedMinutes) : '-'} hint={s ? `${minutesText(s.scheduledMinutes)} scheduled` : undefined} tone="info" icon={Clock} />
                <StatCard compact label="Days absent" value={s?.absentDays ?? '-'} tone={s && s.absentDays > 0 ? 'danger' : 'neutral'} icon={Clock} />
                <StatCard compact label="Days on leave" value={s?.leaveDays ?? '-'} tone="neutral" icon={CalendarClock} />
            </section>

            {annual.length > 0 && (
                <section aria-labelledby="bal-heading" className="space-y-2">
                    <h2 id="bal-heading" className="text-base font-semibold text-neutral-900">Leave balance, {leave.data?.year}</h2>
                    <ul className="grid gap-2 sm:grid-cols-3">
                        {annual.map((b) => (
                            <li key={b.typeId} className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-[var(--shadow-card)]">
                                <p className="text-sm font-medium text-neutral-700">{b.name}</p>
                                <p className="mt-1 text-2xl font-bold text-neutral-900 tabular">{b.unlimited ? 'No limit' : b.remaining}<span className="text-sm font-normal text-neutral-600">{b.unlimited ? '' : ` of ${b.entitled} days left`}</span></p>
                                {b.pending > 0 && <p className="text-xs text-amber-800">{b.pending} day(s) waiting for approval</p>}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section aria-labelledby="next-heading" className="space-y-2">
                <h2 id="next-heading" className="text-base font-semibold text-neutral-900">Your next shifts</h2>
                {d.upcomingShifts.length === 0 ? (
                    <EmptyState icon={CalendarClock} title="No upcoming shifts" description="When HR adds you to the roster, your shifts appear here." />
                ) : (
                    <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[var(--shadow-card)]">
                        {d.upcomingShifts.slice(0, 14).map((sh) => (
                            <li key={sh.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                                <span className="font-medium text-neutral-900">{dayText(sh.date)}</span>
                                <span className="text-neutral-700 tabular">{shiftText(sh)}{sh.label ? ` · ${sh.label}` : ''}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

// ------------------------------------------------------------------------------------------------------ Leave

function LeaveTab() {
    const data = useApi<LeaveData>('/api/hr/me/leave');
    const confirm = useConfirm();
    const [typeId, setTypeId] = useState<number | ''>('');
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [part, setPart] = useState<'FULL' | 'FIRST_HALF' | 'SECOND_HALF'>('FULL');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const type = data.data?.balances.find((b) => b.typeId === typeId);
    const single = start !== '' && (end === '' || end === start);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        if (!typeId) return setError('Choose a leave type.');
        if (!start) return setError('Choose the first day.');
        setBusy(true);
        try {
            const r = await sendJson<{ days: number }>('/api/hr/me/leave', 'POST', { leaveTypeId: typeId, start, end: end || start, dayPart: single ? part : 'FULL', reason: reason || null });
            toast.success('Leave requested', { description: `${r.days} day${r.days === 1 ? '' : 's'}. HR has been notified.` });
            setStart(''); setEnd(''); setReason(''); setPart('FULL');
            data.reload();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(false);
        }
    }

    async function cancel(id: number) {
        if (!(await confirm({ title: 'Cancel this leave request?', description: 'The days go back to your balance.', confirmLabel: 'Cancel request', cancelLabel: 'Keep it', destructive: true }))) return;
        try {
            await sendJson(`/api/hr/me/leave/${id}`, 'DELETE');
            toast.success('Leave cancelled');
            data.reload();
        } catch (err) {
            toast.error((err as Error).message);
        }
    }

    if (data.loading && !data.data) return <LoadingState label="Loading your leave…" />;
    if (data.error || !data.data) return <ErrorState title="Could not load your leave" description={data.error ?? undefined} onRetry={data.reload} />;
    const select = 'h-11 w-full rounded-md border border-input bg-white px-3 text-base md:h-10 md:text-sm';

    return (
        <div className="space-y-6">
            <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-[var(--shadow-card)] sm:p-5" aria-label="Request leave">
                <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900"><CalendarPlus className="h-5 w-5 text-emerald-700" aria-hidden /> Request leave</h2>
                {error && <FormAlert>{error}</FormAlert>}
                <div className="space-y-1.5">
                    <Label htmlFor="lv-type">Leave type</Label>
                    <select id="lv-type" className={select} value={typeId} onChange={(e) => setTypeId(e.target.value ? Number(e.target.value) : '')}>
                        <option value="">Choose…</option>
                        {data.data.balances.map((b) => <option key={b.typeId} value={b.typeId}>{b.name}{b.unlimited ? '' : ` (${b.remaining} left)`}</option>)}
                    </select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label htmlFor="lv-start">First day</Label><Input id="lv-start" type="date" value={start} onChange={(e) => { setStart(e.target.value); if (!end || end < e.target.value) setEnd(e.target.value); }} /></div>
                    <div className="space-y-1.5"><Label htmlFor="lv-end">Last day</Label><Input id="lv-end" type="date" min={start || undefined} value={end} onChange={(e) => setEnd(e.target.value)} /></div>
                </div>
                {single && type?.allowsHalfDay && (
                    <div className="space-y-1.5">
                        <Label htmlFor="lv-part">Part of the day</Label>
                        <select id="lv-part" className={select} value={part} onChange={(e) => setPart(e.target.value as typeof part)}>
                            <option value="FULL">Whole day</option><option value="FIRST_HALF">Morning only</option><option value="SECOND_HALF">Afternoon only</option>
                        </select>
                    </div>
                )}
                <div className="space-y-1.5">
                    <Label htmlFor="lv-reason">Reason <span className="font-normal text-neutral-500">(optional)</span></Label>
                    <textarea id="lv-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className="flex min-h-16 w-full rounded-md border border-input bg-white px-3 py-2 text-base md:text-sm" />
                </div>
                <Button type="submit" disabled={busy} className="h-11 w-full sm:w-auto">{busy ? 'Sending…' : 'Send request'}</Button>
                <p className="text-xs text-neutral-500">Public holidays and your days off are not counted. HR decides, and you are notified.</p>
            </form>

            <section aria-labelledby="my-req" className="space-y-2">
                <h2 id="my-req" className="text-base font-semibold text-neutral-900">Your requests</h2>
                {data.data.requests.length === 0 ? (
                    <EmptyState icon={CalendarClock} title="No leave requests yet" description="Requests you make, and what HR decided, are listed here." />
                ) : (
                    <ul className="space-y-2.5">
                        {data.data.requests.map((r) => (
                            <li key={r.id} className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-[var(--shadow-card)]">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="font-semibold text-neutral-900">{r.typeName}</p>
                                    <StatusBadge status={r.status} kind="leave" size="sm" />
                                </div>
                                <p className="mt-0.5 text-sm text-neutral-700">
                                    {formatDate(r.start)}{r.end !== r.start ? ` to ${formatDate(r.end)}` : r.dayPart === 'FIRST_HALF' ? ' (morning)' : r.dayPart === 'SECOND_HALF' ? ' (afternoon)' : ''} · {r.days} day{r.days === 1 ? '' : 's'}
                                </p>
                                {r.decisionNote && <p className="mt-1 text-sm text-neutral-600">{r.decidedByName ? `${r.decidedByName}: ` : ''}{r.decisionNote}</p>}
                                {(r.status === 'PENDING' || r.status === 'APPROVED') && (
                                    <Button type="button" variant="ghost" size="sm" className="mt-1 -ml-2 h-10 text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => cancel(r.id)}>Cancel request</Button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

// ------------------------------------------------------------------------------------------------------ History

function HistoryTab() {
    const [month, setMonth] = useState<string | null>(null);
    const data = useApi<AttendanceData>(`/api/hr/me/attendance${month ? `?month=${month}` : ''}`);
    const corrections = useApi<{ corrections: CorrectionRow[] }>('/api/hr/me/corrections');
    const confirm = useConfirm();
    const [showAll, setShowAll] = useState(false);
    const [fix, setFix] = useState<DayRow | null>(null);

    const m = month ?? data.data?.month ?? '';
    const rows = useMemo(() => (data.data?.days ?? []).filter((d) => showAll || d.status !== 'DAY_OFF' || d.punches.length > 0).filter((d) => d.day <= (data.data?.today ?? '9999')).reverse(), [data.data, showAll]);

    async function withdraw(id: number) {
        if (!(await confirm({ title: 'Withdraw this correction?', confirmLabel: 'Withdraw', cancelLabel: 'Keep it' }))) return;
        try { await sendJson(`/api/hr/me/corrections/${id}`, 'DELETE'); toast.success('Correction withdrawn'); corrections.reload(); } catch (e) { toast.error((e as Error).message); }
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between gap-2">
                <Button type="button" variant="outline" className="h-11 w-11 p-0" aria-label="Previous month" onClick={() => m && setMonth(shiftMonth(m, -1))}><ChevronLeft className="h-4 w-4" /></Button>
                <h2 className="text-base font-semibold text-neutral-900" aria-live="polite">{m ? monthText(m) : ''}</h2>
                <Button type="button" variant="outline" className="h-11 w-11 p-0" aria-label="Next month" onClick={() => m && setMonth(shiftMonth(m, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>

            {data.loading && !data.data ? <LoadingState label="Loading attendance…" /> : data.error || !data.data ? (
                <ErrorState title="Could not load your attendance" description={data.error ?? undefined} onRetry={data.reload} />
            ) : (
                <>
                    <section aria-label="Month totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <StatCard compact label="Present" value={data.data.summary.presentDays} icon={Clock} />
                        <StatCard compact label="Late" value={data.data.summary.lateDays} tone="warning" icon={Clock} />
                        <StatCard compact label="Absent" value={data.data.summary.absentDays} tone={data.data.summary.absentDays ? 'danger' : 'neutral'} icon={Clock} />
                        <StatCard compact label="Worked" value={minutesText(data.data.summary.workedMinutes)} tone="info" icon={Clock} />
                    </section>

                    <label className="flex min-h-11 items-center gap-2 text-sm text-neutral-700">
                        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="h-4 w-4" /> Show days off
                    </label>

                    {rows.length === 0 ? (
                        <EmptyState icon={CalendarClock} title="Nothing to show for this month" description="Days appear here once you have a shift or clock in." />
                    ) : (
                        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[var(--shadow-card)]">
                            {rows.map((d) => (
                                <li key={d.day} className="space-y-1.5 px-4 py-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="font-semibold text-neutral-900">{dayText(d.day)}</p>
                                        <StatusBadge status={d.status} kind="attendance" size="sm" />
                                    </div>
                                    {d.shifts.length > 0 && <p className="text-xs text-neutral-600">Shift {d.shifts.map(shiftText).join(', ')}</p>}
                                    {d.punches.map((p) => (
                                        <p key={p.id} className="text-sm text-neutral-800 tabular">
                                            {clockText(p.clockIn, data.data!.timezone)} to {p.clockOut ? clockText(p.clockOut, data.data!.timezone) : 'still open'}
                                            {p.source !== 'SELF' && <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-700">{p.source === 'HR' ? 'edited by HR' : 'corrected'}</span>}
                                        </p>
                                    ))}
                                    <p className="flex flex-wrap gap-x-3 text-xs text-neutral-600">
                                        {d.workedMinutes > 0 && <span>Worked {minutesText(d.workedMinutes)}</span>}
                                        {d.lateMinutes > 0 && <span className="text-amber-800">{minutesText(d.lateMinutes)} late</span>}
                                        {d.earlyLeaveMinutes > 0 && <span className="text-amber-800">left {minutesText(d.earlyLeaveMinutes)} early</span>}
                                        {d.extraMinutes > 0 && <span>{minutesText(d.extraMinutes)} extra</span>}
                                        {d.unscheduled && <span>unscheduled</span>}
                                        {d.leaveType && <span>{d.leaveType}</span>}{d.holidayName && <span>{d.holidayName}</span>}
                                    </p>
                                    {(d.status === 'INCOMPLETE' || d.status === 'ABSENT' || d.punches.length > 0) && (
                                        <Button type="button" variant="ghost" size="sm" className="-ml-2 h-10 gap-1.5 text-emerald-800" onClick={() => setFix(d)}><Pencil className="h-3.5 w-3.5" aria-hidden /> Fix this day</Button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}

            {corrections.data && corrections.data.corrections.length > 0 && (
                <section aria-labelledby="corr-heading" className="space-y-2">
                    <h2 id="corr-heading" className="text-base font-semibold text-neutral-900">Your correction requests</h2>
                    <ul className="space-y-2">
                        {corrections.data.corrections.map((c) => (
                            <li key={c.id} className="rounded-xl border border-neutral-200 bg-white p-3.5 text-sm shadow-[var(--shadow-card)]">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-neutral-900">{formatDate(c.workDate)}: {c.clockIn} to {c.clockOut ?? '?'}</span>
                                    <StatusBadge status={c.status} kind="leave" size="sm" />
                                </div>
                                <p className="mt-1 text-neutral-600">{c.reason}</p>
                                {c.decisionNote && <p className="text-neutral-600">HR: {c.decisionNote}</p>}
                                {c.status === 'PENDING' && <Button type="button" variant="ghost" size="sm" className="-ml-2 h-10 text-red-700" onClick={() => withdraw(c.id)}>Withdraw</Button>}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {fix && data.data && (
                <CorrectionDialog day={fix} timezone={data.data.timezone} onClose={() => setFix(null)} onDone={() => { setFix(null); corrections.reload(); }} />
            )}
        </div>
    );
}

function CorrectionDialog({ day, timezone, onClose, onDone }: { day: DayRow; timezone: string; onClose: () => void; onDone: () => void }) {
    const first = day.punches[0];
    const [inT, setInT] = useState(first ? clockText(first.clockIn, timezone) : day.shifts[0]?.start ?? '');
    const [outT, setOutT] = useState(first?.clockOut ? clockText(first.clockOut, timezone) : day.shifts[day.shifts.length - 1]?.end ?? '');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setError(''); setBusy(true);
        try {
            await sendJson('/api/hr/me/corrections', 'POST', { workDate: day.day, recordId: first?.id ?? null, clockIn: inT, clockOut: outT || null, reason });
            toast.success('Correction sent to HR');
            onDone();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <form onSubmit={submit} noValidate className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Fix {dayText(day.day)}</DialogTitle>
                        <DialogDescription>Tell HR the times that are right. They approve it, and the original punch stays on record.</DialogDescription>
                    </DialogHeader>
                    {error && <FormAlert>{error}</FormAlert>}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5"><Label htmlFor="c-in">Started</Label><Input id="c-in" type="time" value={inT} onChange={(e) => setInT(e.target.value)} /></div>
                        <div className="space-y-1.5"><Label htmlFor="c-out">Finished</Label><Input id="c-out" type="time" value={outT} onChange={(e) => setOutT(e.target.value)} /></div>
                    </div>
                    <div className="space-y-1.5"><Label htmlFor="c-reason">What happened?</Label><textarea id="c-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className="flex w-full rounded-md border border-input bg-white px-3 py-2 text-base md:text-sm" /></div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send to HR'}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ------------------------------------------------------------------------------------------------------ page

/** Everyone on staff has this page: today's clock, their leave, and their own attendance history. */
export function MyWork() {
    const [tab, setTab] = useState('today');
    return (
        <div className="mx-auto max-w-3xl space-y-5">
            <PageHeader title="My Work" description="Clock in and out, request leave, and see your own attendance." />
            <SegmentedTabs label="My Work sections" value={tab} onChange={setTab} items={[{ value: 'today', label: 'Today' }, { value: 'leave', label: 'Leave' }, { value: 'history', label: 'History' }]} />
            <div role="tabpanel">
                {tab === 'today' && <TodayTab />}
                {tab === 'leave' && <LeaveTab />}
                {tab === 'history' && <HistoryTab />}
            </div>
        </div>
    );
}
