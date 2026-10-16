'use client';
import { useCan } from '@/components/access/AccessContext';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Copy, Plus, Save, Trash2, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingState } from '@/components/ui/state-views';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useApi, sendJson } from '@/hooks/useApi';
import { friendlyDay } from '@/lib/dates';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SLOT_LENGTHS = [5, 10, 15, 20, 30, 45, 60];
const WEEKDAYS = DAYS.slice(0, 5);

interface Session { day: string; start: string; end: string }
interface Leave { id: number; date: string; reason: string | null; fromHr: boolean; booked: number }
interface Loaded { doctor: { id: number; name: string; specialization: string }; slotDuration: number; sessions: Session[]; leaves: Leave[]; today: string }
interface Impact { days: number; alreadyBlocked: number; affectedAppointments: number }

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const slotCount = (s: Session, length: number) => (minutes(s.end) > minutes(s.start) ? Math.ceil((minutes(s.end) - minutes(s.start)) / length) : 0);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** What is wrong with the hours as typed, or null. Mirrors the server's checks so the admin finds out before saving. */
function problem(sessions: Session[]): string | null {
    for (const day of DAYS) {
        const list = sessions.filter((s) => s.day === day).sort((a, b) => a.start.localeCompare(b.start));
        for (let i = 0; i < list.length; i++) {
            if (!list[i].start || !list[i].end) return `${day}: enter both times`;
            if (minutes(list[i].end) <= minutes(list[i].start)) return `${day}: a session must end after it starts`;
            if (i > 0 && minutes(list[i].start) < minutes(list[i - 1].end)) return `${day}: sessions overlap`;
        }
    }
    return null;
}

export default function DoctorSchedulePage() {
    const canChange = useCan('admin.doctors', 'change');
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const confirm = useConfirm();
    const { data, loading, error, reload } = useApi<Loaded>(`/api/admin/doctors/${id}/schedule`);
    const { data: doctors } = useApi<{ id: number; name: string }[]>('/api/admin/doctors');

    const [sessions, setSessions] = useState<Session[]>([]);
    const [slot, setSlot] = useState(15);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [copyFrom, setCopyFrom] = useState<string | null>(null);

    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [reason, setReason] = useState('');
    const [impact, setImpact] = useState<Impact | null>(null);
    const [impactError, setImpactError] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        if (!data) return;
        setSessions(data.sessions);
        setSlot(data.slotDuration);
        setDirty(false);
    }, [data]);

    // Preview what the time off would do before it is saved
    useEffect(() => {
        setImpact(null);
        setImpactError(null);
        if (!from) return;
        const timer = setTimeout(() => {
            sendJson<Impact>(`/api/admin/doctors/${id}/leaves`, 'POST', { from, to: to || from, dryRun: true })
                .then(setImpact)
                .catch((e: Error) => setImpactError(e.message));
        }, 300);
        return () => clearTimeout(timer);
    }, [from, to, id]);

    const issue = useMemo(() => problem(sessions), [sessions]);
    const totalSlots = (day: string) => sessions.filter((s) => s.day === day).reduce((n, s) => n + slotCount(s, slot), 0);

    const change = (next: Session[]) => { setSessions(next); setDirty(true); };
    const update = (target: Session, patch: Partial<Session>) => change(sessions.map((s) => (s === target ? { ...s, ...patch } : s)));
    const remove = (target: Session) => change(sessions.filter((s) => s !== target));
    const addTo = (day: string) => {
        const last = sessions.filter((s) => s.day === day).sort((a, b) => a.end.localeCompare(b.end)).pop();
        const start = last ? last.end : '09:00';
        const end = minutes(start) + 180 <= 24 * 60 - 1 ? `${String(Math.floor((minutes(start) + 180) / 60)).padStart(2, '0')}:${String((minutes(start) + 180) % 60).padStart(2, '0')}` : '23:59';
        change([...sessions, { day, start, end }]);
    };
    const copyDay = (source: string, targets: string[]) => {
        const mine = sessions.filter((s) => s.day === source);
        change([...sessions.filter((s) => !targets.includes(s.day) || s.day === source), ...targets.filter((t) => t !== source).flatMap((t) => mine.map((s) => ({ ...s, day: t })))]);
        setCopyFrom(null);
    };

    const save = async () => {
        setSaving(true);
        try {
            const res = await sendJson<{ outsideSchedule: number }>(`/api/admin/doctors/${id}/schedule`, 'PUT', { slotDuration: slot, sessions });
            toast.success(res.outsideSchedule > 0
                ? `Saved. ${plural(res.outsideSchedule, 'booked appointment')} no longer fit the new hours and need rescheduling.`
                : 'Working hours saved');
            reload();
        } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
    };

    const addTimeOff = async () => {
        setAdding(true);
        try {
            const res = await sendJson<Impact>(`/api/admin/doctors/${id}/leaves`, 'POST', { from, to: to || from, reason });
            toast.success(`${plural(res.days, 'day')} blocked${res.affectedAppointments ? `. ${plural(res.affectedAppointments, 'patient booking')} to reschedule, patients and reception were told.` : ''}`);
            setFrom(''); setTo(''); setReason('');
            reload();
        } catch (e: any) { toast.error(e.message); } finally { setAdding(false); }
    };

    const removeLeave = async (leave: Leave) => {
        if (!await confirm({
            title: `Remove time off on ${friendlyDay(leave.date)}?`,
            description: 'Patients will be able to book this doctor on that day again.',
            confirmLabel: 'Remove', cancelLabel: 'Keep',
        })) return;
        try { await sendJson(`/api/admin/doctors/${id}/leaves?id=${leave.id}`, 'DELETE'); reload(); } catch (e: any) { toast.error(e.message); }
    };

    if (loading && !data) return <LoadingState label="Loading schedule…" />;
    if (error || !data) return <p role="alert" className="py-16 text-center text-red-600">{error || 'Could not load this doctor.'}</p>;

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <Link href="/admin/doctors" className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden /> All doctors</Link>
            <PageHeader title={`${data.doctor.name}: schedule`} description={`${data.doctor.specialization}. Working hours and time off. Patients only see times set here.`} />

            <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="pick-doctor" className="text-sm">Doctor</Label>
                <select id="pick-doctor" value={id} className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    onChange={(e) => { if (!dirty || window.confirm('Discard the unsaved changes?')) router.push(`/admin/doctors/${e.target.value}`); }}>
                    {(doctors ?? [{ id: data.doctor.id, name: data.doctor.name }]).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
            </div>

            {!canChange && <p role="status" className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">You can view this schedule but not change it.</p>}
            <fieldset disabled={!canChange} className="contents">
            <Card>
                <CardHeader>
                    <CardTitle>Weekly hours</CardTitle>
                    <CardDescription>Add one or more sessions per day (for example morning and evening). A day with no session is a day off.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="slot-length" className="text-sm">Appointment length</Label>
                        <select id="slot-length" value={slot} onChange={(e) => { setSlot(Number(e.target.value)); setDirty(true); }} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                            {SLOT_LENGTHS.map((n) => <option key={n} value={n}>{n} minutes</option>)}
                        </select>
                    </div>

                    <ul className="divide-y rounded-lg border">
                        {DAYS.map((day) => {
                            const list = sessions.filter((s) => s.day === day);
                            return (
                                <li key={day} className="space-y-2 px-3 py-3 sm:px-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-baseline gap-3">
                                            <span className="w-24 font-medium">{day}</span>
                                            <span className="text-xs text-neutral-500">{list.length === 0 ? 'Not working' : plural(totalSlots(day), 'bookable slot')}</span>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button type="button" variant="outline" size="sm" onClick={() => addTo(day)}><Plus className="mr-1 h-3.5 w-3.5" aria-hidden /> Add hours</Button>
                                            {list.length > 0 && (
                                                <Button type="button" variant="ghost" size="sm" onClick={() => setCopyFrom(copyFrom === day ? null : day)} aria-label={`Copy ${day} to other days`}>
                                                    <Copy className="mr-1 h-3.5 w-3.5" aria-hidden /> Copy to…
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    {copyFrom === day && (
                                        <div className="flex flex-wrap gap-2 rounded-md bg-neutral-50 p-2 text-sm">
                                            <Button type="button" size="sm" variant="outline" onClick={() => copyDay(day, WEEKDAYS)}>Monday to Friday</Button>
                                            <Button type="button" size="sm" variant="outline" onClick={() => copyDay(day, DAYS)}>Every day</Button>
                                            {DAYS.filter((d) => d !== day).map((d) => <Button key={d} type="button" size="sm" variant="ghost" onClick={() => copyDay(day, [d])}>{d.slice(0, 3)}</Button>)}
                                        </div>
                                    )}
                                    {list.map((s, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <Input aria-label={`${day} session ${i + 1} start`} type="time" className="h-9 w-32" value={s.start} onChange={(e) => update(s, { start: e.target.value })} />
                                            <span aria-hidden>to</span>
                                            <Input aria-label={`${day} session ${i + 1} end`} type="time" className="h-9 w-32" value={s.end} onChange={(e) => update(s, { end: e.target.value })} />
                                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(s)} aria-label={`Remove ${day} session ${i + 1}`}><X className="h-4 w-4" aria-hidden /></Button>
                                        </div>
                                    ))}
                                </li>
                            );
                        })}
                    </ul>

                    {issue && <p role="alert" className="text-sm text-red-600">{issue}</p>}
                    <div className="flex items-center justify-end gap-3">
                        {dirty && <span className="text-sm text-amber-700">Unsaved changes</span>}
                        <Button onClick={save} disabled={saving || !dirty || Boolean(issue)} className="bg-emerald-600 hover:bg-emerald-700">
                            <Save className="mr-2 h-4 w-4" aria-hidden /> {saving ? 'Saving…' : 'Save hours'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Time off</CardTitle>
                    <CardDescription>Block one day or a whole range. Patients cannot book those days; bookings already made are kept and the patients are told.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1">
                            <Label htmlFor="off-from">From</Label>
                            <Input id="off-from" type="date" min={data.today} value={from} onChange={(e) => { setFrom(e.target.value); if (to && to < e.target.value) setTo(''); }} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="off-to">Until (optional)</Label>
                            <Input id="off-to" type="date" min={from || data.today} value={to} onChange={(e) => setTo(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="off-reason">Reason (optional)</Label>
                            <Input id="off-reason" maxLength={255} placeholder="Conference, holiday…" value={reason} onChange={(e) => setReason(e.target.value)} />
                        </div>
                    </div>
                    {impactError && <p role="alert" className="text-sm text-red-600">{impactError}</p>}
                    {impact && (
                        <p role="status" className={`rounded-md p-3 text-sm ${impact.affectedAppointments ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900'}`}>
                            {impact.days === 0
                                ? 'Every one of those days is already blocked.'
                                : `${plural(impact.days, 'day')} will be blocked${impact.alreadyBlocked ? ` (${plural(impact.alreadyBlocked, 'day')} already blocked are skipped)` : ''}. `}
                            {impact.days > 0 && (impact.affectedAppointments
                                ? `${plural(impact.affectedAppointments, 'booked appointment')} fall on these days. They are not cancelled; patients and reception are notified to reschedule.`
                                : 'No appointments are booked on these days.')}
                        </p>
                    )}
                    <Button onClick={addTimeOff} disabled={!from || adding || Boolean(impactError) || impact?.days === 0}>{adding ? 'Blocking…' : 'Block these days'}</Button>

                    <div>
                        <h3 className="mb-2 text-sm font-semibold">Upcoming time off</h3>
                        {data.leaves.length === 0 ? <p className="text-sm text-neutral-500">None scheduled.</p> : (
                            <ul className="divide-y rounded-lg border">
                                {data.leaves.map((l) => (
                                    <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm sm:px-4">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-medium">{friendlyDay(l.date)}</span>
                                            {l.reason && <span className="text-neutral-500">{l.reason}</span>}
                                            {l.fromHr && <Badge variant="outline">From approved HR leave</Badge>}
                                            {l.booked > 0 && <Badge variant="outline" className="border-amber-300 text-amber-800">{plural(l.booked, 'booking')} to reschedule</Badge>}
                                        </div>
                                        {l.fromHr
                                            ? <span className="text-xs text-neutral-500">Change it in the HR portal</span>
                                            : <Button type="button" variant="ghost" size="icon" onClick={() => removeLeave(l)} aria-label={`Remove time off on ${l.date}`}><Trash2 className="h-4 w-4" aria-hidden /></Button>}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </CardContent>
            </Card>
            </fieldset>
        </div>
    );
}
