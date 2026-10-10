'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state-views';
import { FormAlert } from '@/components/ui/text-field';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePrompt } from '@/components/ui/confirm-dialog';
import { sendJson, useApi } from '@/hooks/useApi';
import { clockText, dayText, minutesText, shiftText, todayGuess } from '@/lib/hr-format';
import { formatDate } from '@/lib/dates';

interface Day {
    day: string; status: string; workedMinutes: number; lateMinutes: number; earlyLeaveMinutes: number; extraMinutes: number; unscheduled: boolean; leaveType: string | null; holidayName: string | null;
    shifts: { id: number; start: string; end: string }[]; punches: { id: number; clockIn: string; clockOut: string | null; source: string; note: string | null }[];
}
interface Person {
    id: number; name: string; role: string; department: string | null; employeeNo: string | null; days: Day[];
    summary: { presentDays: number; lateDays: number; absentDays: number; leaveDays: number; incompleteDays: number; workedMinutes: number; lateMinutes: number; extraMinutes: number };
}
interface AttendanceData { timezone: string; today: string; employees: Person[] }
interface Correction { id: number; userId: number; employee: string; workDate: string; clockIn: string; clockOut: string | null; reason: string; status: string }

function monthStart() { return `${todayGuess().slice(0, 7)}-01`; }

function PunchDialog({ person, day, punch, timezone, onClose, onDone }: {
    person: { id: number; name: string }; day: string; punch: Day['punches'][number] | null; timezone: string; onClose: () => void; onDone: () => void;
}) {
    const [inT, setInT] = useState(punch ? clockText(punch.clockIn, timezone) : '');
    const [outT, setOutT] = useState(punch?.clockOut ? clockText(punch.clockOut, timezone) : '');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setError(''); setBusy(true);
        try {
            const body = { workDate: day, clockIn: inT, clockOut: outT || null, reason };
            if (punch) await sendJson(`/api/hr/attendance/records/${punch.id}`, 'PUT', body);
            else await sendJson('/api/hr/attendance/records', 'POST', { ...body, userId: person.id });
            toast.success(punch ? 'Attendance updated' : 'Session added');
            onDone();
        } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
    }

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <form onSubmit={submit} noValidate className="space-y-4">
                    <DialogHeader><DialogTitle>{punch ? 'Change session' : 'Add a session'}</DialogTitle><DialogDescription>{person.name}, {formatDate(day)}. The reason is kept with the record and in the audit trail, and the employee is told.</DialogDescription></DialogHeader>
                    {error && <FormAlert>{error}</FormAlert>}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5"><Label htmlFor="p-in">Clock in</Label><Input id="p-in" type="time" value={inT} onChange={(e) => setInT(e.target.value)} /></div>
                        <div className="space-y-1.5"><Label htmlFor="p-out">Clock out</Label><Input id="p-out" type="time" value={outT} onChange={(e) => setOutT(e.target.value)} /></div>
                    </div>
                    <div className="space-y-1.5"><Label htmlFor="p-reason">Reason</Label><textarea id="p-reason" rows={2} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} className="flex w-full rounded-md border border-input bg-white px-3 py-2 text-base md:text-sm" /></div>
                    <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button></DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function Corrections({ onChanged }: { onChanged: () => void }) {
    const { data, reload } = useApi<{ corrections: Correction[] }>('/api/hr/corrections');
    const askText = usePrompt();
    if (!data || data.corrections.length === 0) return null;

    async function decide(c: Correction, decision: 'APPROVE' | 'REJECT') {
        let note: string | null = null;
        if (decision === 'REJECT') {
            note = await askText({ title: 'Decline this correction', label: 'Reason (the employee will see it)', placeholder: 'For example: no record of you being here', confirmLabel: 'Decline' });
            if (note === null) return;
        }
        try { await sendJson(`/api/hr/corrections/${c.id}`, 'PUT', { decision, note }); toast.success(decision === 'APPROVE' ? 'Correction approved' : 'Correction declined'); reload(); onChanged(); } catch (err) { toast.error((err as Error).message); }
    }

    return (
        <section aria-labelledby="corr" className="space-y-2 rounded-xl border border-amber-200 bg-warning-soft p-4">
            <h2 id="corr" className="text-base font-semibold text-warning">Corrections waiting for you ({data.corrections.length})</h2>
            <ul className="space-y-2">
                {data.corrections.map((c) => (
                    <li key={c.id} className="rounded-lg border border-amber-200 bg-white p-3 text-sm">
                        <p className="font-semibold text-neutral-900">{c.employee}: {formatDate(c.workDate)}, {c.clockIn} to {c.clockOut ?? '?'}</p>
                        <p className="text-neutral-700">{c.reason}</p>
                        <div className="mt-2 flex gap-2">
                            <Button type="button" size="sm" className="h-10" onClick={() => decide(c, 'APPROVE')}>Approve</Button>
                            <Button type="button" size="sm" variant="outline" className="h-10" onClick={() => decide(c, 'REJECT')}>Decline</Button>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}

export default function AttendancePage() {
    const askText = usePrompt();
    const [from, setFrom] = useState(monthStart());
    const [to, setTo] = useState(todayGuess());
    const [userId, setUserId] = useState('');
    const [department, setDepartment] = useState('');
    const [open, setOpen] = useState<number | null>(null);
    const [editing, setEditing] = useState<{ person: Person; day: string; punch: Day['punches'][number] | null } | null>(null);

    const params = new URLSearchParams({ from, to });
    if (userId) params.set('userId', userId);
    if (department) params.set('department', department);
    const { data, loading, error, reload } = useApi<AttendanceData>(`/api/hr/attendance?${params}`);
    const roster = useApi<{ employees: { id: number; name: string; department: string | null }[] }>('/api/hr/employees');
    const departments = useMemo(() => [...new Set((roster.data?.employees ?? []).map((e) => e.department).filter(Boolean) as string[])].sort(), [roster.data]);

    async function removePunch(person: Person, punchId: number, day: string) {
        const reason = await askText({
            title: 'Delete this session?', label: `Why? (${person.name}, ${formatDate(day)}. The reason stays in the audit trail.)`,
            placeholder: 'For example: entered by mistake', confirmLabel: 'Delete session',
        });
        if (reason === null) return;
        try { await sendJson(`/api/hr/attendance/records/${punchId}?reason=${encodeURIComponent(reason)}`, 'DELETE'); toast.success('Session deleted'); reload(); } catch (err) { toast.error((err as Error).message); }
    }

    return (
        <div className="space-y-5">
            <PageHeader
                title="Attendance"
                description="Attendance for everyone, by day. Open a person to see each day, and fix a session when needed."
                actions={<Button asChild variant="outline" className="h-11 gap-2"><a href={`/api/hr/attendance/export?${params}`}><Download className="h-4 w-4" aria-hidden /> Export CSV</a></Button>}
            />

            <Corrections onChanged={reload} />

            <form className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-[var(--shadow-card)] sm:grid-cols-2 lg:grid-cols-4" aria-label="Filters" onSubmit={(e) => e.preventDefault()}>
                <div className="space-y-1.5"><Label htmlFor="a-from">From</Label><Input id="a-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="a-to">To</Label><Input id="a-to" type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="a-emp">Employee</Label>
                    <select id="a-emp" className="h-11 w-full rounded-md border border-input bg-white px-3 text-base md:h-10 md:text-sm" value={userId} onChange={(e) => setUserId(e.target.value)}>
                        <option value="">Everyone</option>{(roster.data?.employees ?? []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                </div>
                <div className="space-y-1.5"><Label htmlFor="a-dep">Department</Label>
                    <select id="a-dep" className="h-11 w-full rounded-md border border-input bg-white px-3 text-base md:h-10 md:text-sm" value={department} onChange={(e) => setDepartment(e.target.value)}>
                        <option value="">All</option>{departments.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
            </form>

            {loading && !data ? <LoadingState label="Loading attendance…" /> : error || !data ? <ErrorState title="Could not load attendance" description={error ?? undefined} onRetry={reload} /> : data.employees.length === 0 ? (
                <EmptyState title="No employees match" description="Change the filters above." />
            ) : (
                <ul className="space-y-2.5">
                    {data.employees.map((p) => {
                        const expanded = open === p.id;
                        return (
                            <li key={p.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[var(--shadow-card)]">
                                <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : p.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50">
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-semibold text-neutral-900">{p.name}</span>
                                        <span className="block text-xs text-neutral-600">{p.department ?? 'No department'}{p.employeeNo ? ` · #${p.employeeNo}` : ''}</span>
                                    </span>
                                    <span className="hidden gap-4 text-sm text-neutral-700 sm:flex">
                                        <span>{p.summary.presentDays} present</span><span className={p.summary.lateDays ? 'text-amber-800' : ''}>{p.summary.lateDays} late</span>
                                        <span className={p.summary.absentDays ? 'font-semibold text-red-700' : ''}>{p.summary.absentDays} absent</span><span>{minutesText(p.summary.workedMinutes)}</span>
                                    </span>
                                    {expanded ? <ChevronUp className="h-5 w-5 text-neutral-500" aria-hidden /> : <ChevronDown className="h-5 w-5 text-neutral-500" aria-hidden />}
                                </button>
                                <p className="border-t border-neutral-100 px-4 py-1.5 text-xs text-neutral-600 sm:hidden">{p.summary.presentDays} present, {p.summary.lateDays} late, {p.summary.absentDays} absent, {minutesText(p.summary.workedMinutes)} worked</p>
                                {expanded && (
                                    <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
                                        {p.days.filter((d) => d.status !== 'DAY_OFF' || d.punches.length > 0).filter((d) => d.day <= data.today).reverse().map((d) => (
                                            <li key={d.day} className="space-y-1 px-4 py-2.5 text-sm">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <span className="font-medium text-neutral-900">{dayText(d.day)}{d.shifts.length > 0 && <span className="ml-2 text-xs font-normal text-neutral-600">{d.shifts.map(shiftText).join(', ')}</span>}</span>
                                                    <StatusBadge status={d.status} kind="attendance" size="sm" />
                                                </div>
                                                {d.punches.map((pu) => (
                                                    <div key={pu.id} className="flex flex-wrap items-center justify-between gap-2">
                                                        <span className="text-neutral-800 tabular">{clockText(pu.clockIn, data.timezone)} to {pu.clockOut ? clockText(pu.clockOut, data.timezone) : 'open'}{pu.source !== 'SELF' && <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[11px]">{pu.source === 'HR' ? 'HR edit' : 'correction'}{pu.note ? `: ${pu.note}` : ''}</span>}</span>
                                                        <span className="flex gap-1">
                                                            <Button type="button" variant="ghost" size="sm" className="h-10 gap-1" onClick={() => setEditing({ person: p, day: d.day, punch: pu })}><Pencil className="h-3.5 w-3.5" aria-hidden /> Edit</Button>
                                                            <Button type="button" variant="ghost" size="sm" className="h-10 gap-1 text-red-700" onClick={() => removePunch(p, pu.id, d.day)} aria-label={`Delete session on ${dayText(d.day)}`}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
                                                        </span>
                                                    </div>
                                                ))}
                                                <p className="flex flex-wrap items-center gap-x-3 text-xs text-neutral-600">
                                                    {d.workedMinutes > 0 && <span>Worked {minutesText(d.workedMinutes)}</span>}
                                                    {d.lateMinutes > 0 && <span className="text-amber-800">{minutesText(d.lateMinutes)} late</span>}
                                                    {d.earlyLeaveMinutes > 0 && <span className="text-amber-800">left {minutesText(d.earlyLeaveMinutes)} early</span>}
                                                    {d.extraMinutes > 0 && <span>{minutesText(d.extraMinutes)} extra</span>}
                                                    {d.unscheduled && <span>unscheduled</span>}{d.leaveType && <span>{d.leaveType}</span>}{d.holidayName && <span>{d.holidayName}</span>}
                                                    <Button type="button" variant="ghost" size="sm" className="h-9 gap-1 text-emerald-800" onClick={() => setEditing({ person: p, day: d.day, punch: null })}><Plus className="h-3.5 w-3.5" aria-hidden /> Add session</Button>
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {editing && data && <PunchDialog person={editing.person} day={editing.day} punch={editing.punch} timezone={data.timezone} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
        </div>
    );
}
