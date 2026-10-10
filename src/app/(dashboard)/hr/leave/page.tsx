'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarOff, Check, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state-views';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { FormAlert } from '@/components/ui/text-field';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { sendJson, useApi } from '@/hooks/useApi';
import { ROLE_LABEL, addDaysText, dayText, mondayOf, todayGuess } from '@/lib/hr-format';
import { formatDate } from '@/lib/dates';

interface Request {
    id: number; userId: number; employee: string; role: string; department: string | null; typeName: string; paid: number; start: string; end: string; dayPart: string; days: number;
    reason: string | null; status: string; decisionNote: string | null; decidedByName: string | null;
    balanceRemaining?: number | null; othersOff?: string[]; othersOffCount?: number; bookedAppointments?: number;
}

function rangeText(r: Request) {
    const part = r.dayPart === 'FIRST_HALF' ? ' (morning)' : r.dayPart === 'SECOND_HALF' ? ' (afternoon)' : '';
    return `${formatDate(r.start)}${r.end !== r.start ? ` to ${formatDate(r.end)}` : ''}${part}`;
}

function DecisionDialog({ request, decision, onClose, onDone }: { request: Request; decision: 'APPROVE' | 'REJECT'; onClose: () => void; onDone: () => void }) {
    const [note, setNote] = useState('');
    const [days, setDays] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const approve = decision === 'APPROVE';

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setError(''); setBusy(true);
        try {
            const r = await sendJson<{ days: number; blockedDoctorDays: number; affectedAppointments: number }>(`/api/hr/leave/${request.id}`, 'PUT', {
                decision, note: note || null, ...(approve && days ? { days: Number(days) } : {}),
            });
            toast.success(approve ? 'Leave approved' : 'Leave declined', {
                description: approve && r.blockedDoctorDays > 0 ? `${r.blockedDoctorDays} day(s) are now closed for patient bookings${r.affectedAppointments ? `, and ${r.affectedAppointments} booked patient(s) were told to rebook` : ''}.` : undefined,
            });
            onDone();
        } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
    }

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <form onSubmit={submit} noValidate className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>{approve ? 'Approve' : 'Decline'} leave for {request.employee}</DialogTitle>
                        <DialogDescription>{request.typeName}, {rangeText(request)}, {request.days} day{request.days === 1 ? '' : 's'}.</DialogDescription>
                    </DialogHeader>
                    {error && <FormAlert>{error}</FormAlert>}
                    {approve && request.role === 'DOCTOR' && request.dayPart === 'FULL' && (
                        <FormAlert tone="info">Approving closes these days for patient bookings.{request.bookedAppointments ? ` ${request.bookedAppointments} appointment(s) are already booked; those patients will be asked to rebook.` : ''}</FormAlert>
                    )}
                    {approve && (
                        <div className="space-y-1.5"><Label htmlFor="d-days">Days to charge <span className="font-normal text-neutral-500">(leave empty to use {request.days})</span></Label><Input id="d-days" inputMode="decimal" placeholder={String(request.days)} value={days} onChange={(e) => setDays(e.target.value)} /></div>
                    )}
                    <div className="space-y-1.5"><Label htmlFor="d-note">Note to the employee {approve ? '(optional)' : ''}</Label><textarea id="d-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="flex w-full rounded-md border border-input bg-white px-3 py-2 text-base md:text-sm" /></div>
                    <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy} variant={approve ? 'default' : 'destructive'}>{busy ? 'Saving…' : approve ? 'Approve' : 'Decline'}</Button></DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function RequestCard({ r, onDecide }: { r: Request; onDecide?: (d: 'APPROVE' | 'REJECT') => void }) {
    return (
        <li className="rounded-xl border border-neutral-200 bg-white p-4 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <p className="font-semibold text-neutral-900">{r.employee}</p>
                    <p className="text-xs text-neutral-600">{ROLE_LABEL[r.role] ?? r.role}{r.department ? ` · ${r.department}` : ''}</p>
                </div>
                <StatusBadge status={r.status} kind="leave" size="sm" />
            </div>
            <p className="mt-2 text-sm text-neutral-900"><span className="font-medium">{r.typeName}</span>{r.paid ? '' : ' (unpaid)'} · {rangeText(r)} · {r.days} day{r.days === 1 ? '' : 's'}</p>
            {r.reason && <p className="mt-1 text-sm text-neutral-700">“{r.reason}”</p>}
            {r.status === 'PENDING' && (
                <ul className="mt-2 space-y-0.5 text-xs text-neutral-700">
                    {r.balanceRemaining !== undefined && <li>{r.balanceRemaining === null ? 'No balance limit for this type.' : `${r.balanceRemaining} day(s) were available before this request.`}</li>}
                    {r.othersOffCount ? <li>{r.othersOffCount} other staff already off then: {r.othersOff?.join(', ')}{(r.othersOffCount ?? 0) > (r.othersOff?.length ?? 0) ? ' and more' : ''}.</li> : <li>Nobody else is off then.</li>}
                    {r.role === 'DOCTOR' && <li className={r.bookedAppointments ? 'font-semibold text-amber-800' : ''}>{r.bookedAppointments ? `${r.bookedAppointments} patient appointment(s) are booked on those days.` : 'No patient appointments are booked on those days.'}</li>}
                </ul>
            )}
            {r.decidedByName && <p className="mt-1 text-xs text-neutral-600">Decided by {r.decidedByName}{r.decisionNote ? `: ${r.decisionNote}` : ''}</p>}
            {onDecide && (
                <div className="mt-3 flex gap-2">
                    <Button type="button" className="h-11 flex-1 gap-1.5 sm:flex-none" onClick={() => onDecide('APPROVE')}><Check className="h-4 w-4" aria-hidden /> Approve</Button>
                    <Button type="button" variant="outline" className="h-11 flex-1 gap-1.5 sm:flex-none" onClick={() => onDecide('REJECT')}><X className="h-4 w-4" aria-hidden /> Decline</Button>
                </div>
            )}
        </li>
    );
}

function WhoIsOff() {
    const [from, setFrom] = useState(() => mondayOf(todayGuess()));
    const to = addDaysText(from, 34);
    const roster = useApi<{ leave: { userId: number; start: string; end: string; dayPart: string; type: string; status: string }[] }>(`/api/hr/shifts?from=${from}&to=${to}`);
    const emps = useApi<{ employees: { id: number; name: string }[] }>('/api/hr/employees');
    const grouped = useMemo(() => {
        const map = new Map<string, { name: string; type: string; status: string; part: string }[]>();
        for (const l of roster.data?.leave ?? []) {
            for (let d = l.start < from ? from : l.start; d <= l.end && d <= to; d = addDaysText(d, 1)) {
                map.set(d, [...(map.get(d) ?? []), { name: emps.data?.employees.find((e) => e.id === l.userId)?.name ?? `#${l.userId}`, type: l.type, status: l.status, part: l.dayPart }]);
            }
        }
        return [...map].sort(([a], [b]) => (a < b ? -1 : 1));
    }, [roster.data, emps.data, from, to]);

    if (roster.loading && !roster.data) return <LoadingState label="Loading the calendar…" />;
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2"><Label htmlFor="off-from" className="text-sm">From</Label><Input id="off-from" type="date" className="w-auto" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} /><span className="text-sm text-neutral-600">for five weeks</span></div>
            {grouped.length === 0 ? <EmptyState icon={CalendarOff} title="Nobody is off in this period" /> : (
                <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[var(--shadow-card)]">
                    {grouped.map(([d, list]) => (
                        <li key={d} className="px-4 py-2.5 text-sm">
                            <p className="font-semibold text-neutral-900">{dayText(d)}</p>
                            <p className="text-neutral-700">{list.map((p) => `${p.name} (${p.type}${p.part !== 'FULL' ? ', half day' : ''}${p.status === 'PENDING' ? ', not yet approved' : ''})`).join('; ')}</p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default function HrLeavePage() {
    const [tab, setTab] = useState('PENDING');
    const [deciding, setDeciding] = useState<{ r: Request; decision: 'APPROVE' | 'REJECT' } | null>(null);
    const pending = useApi<{ requests: Request[] }>('/api/hr/leave?status=PENDING');
    const history = useApi<{ requests: Request[] }>(tab === 'HISTORY' ? '/api/hr/leave?status=ALL' : null);

    const reload = () => { pending.reload(); history.reload(); };

    return (
        <div className="space-y-5">
            <PageHeader title="Leave" description="Requests from staff, and who is off when." />
            <SegmentedTabs label="Leave sections" value={tab} onChange={setTab} items={[{ value: 'PENDING', label: 'Waiting', badge: pending.data?.requests.length }, { value: 'HISTORY', label: 'All requests' }, { value: 'OFF', label: 'Who is off' }]} />

            {tab === 'PENDING' && (pending.loading && !pending.data ? <LoadingState label="Loading requests…" /> : pending.error || !pending.data ? <ErrorState title="Could not load requests" description={pending.error ?? undefined} onRetry={pending.reload} /> : pending.data.requests.length === 0 ? (
                <EmptyState icon={CalendarOff} title="Nothing waiting" description="New leave requests from staff appear here, and you are notified." />
            ) : (
                <ul className="space-y-3">{pending.data.requests.map((r) => <RequestCard key={r.id} r={r} onDecide={(d) => setDeciding({ r, decision: d })} />)}</ul>
            ))}

            {tab === 'HISTORY' && (history.loading && !history.data ? <LoadingState label="Loading…" /> : history.error || !history.data ? <ErrorState title="Could not load requests" description={history.error ?? undefined} onRetry={history.reload} /> : history.data.requests.length === 0 ? (
                <EmptyState icon={CalendarOff} title="No leave requests yet" />
            ) : (
                <ul className="space-y-3">{history.data.requests.map((r) => <RequestCard key={r.id} r={r} onDecide={r.status === 'PENDING' ? (d) => setDeciding({ r, decision: d }) : undefined} />)}</ul>
            ))}

            {tab === 'OFF' && <WhoIsOff />}

            {deciding && <DecisionDialog request={deciding.r} decision={deciding.decision} onClose={() => setDeciding(null)} onDone={() => { setDeciding(null); reload(); }} />}
        </div>
    );
}
