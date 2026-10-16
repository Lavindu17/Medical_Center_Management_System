'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarPlus, ChevronLeft, ChevronRight, Copy, Plus, Trash2, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state-views';
import { FormAlert } from '@/components/ui/text-field';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { sendJson, useApi } from '@/hooks/useApi';
import { ROLE_LABEL, addDaysText, dayText, mondayOf, todayGuess } from '@/lib/hr-format';
import { formatDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

interface Employee { id: number; name: string; role: string; department: string | null; status: string }
interface ShiftRow { id: number; user_id: number; shift_date: string; start_time: string; end_time: string; label: string | null }
interface Roster {
    timezone: string; shifts: ShiftRow[]; holidays: { date: string; name: string }[];
    leave: { userId: number; start: string; end: string; dayPart: string; type: string; status: string }[];
}
interface Template { id: number; name: string; start: string; end: string; active: number }
interface Skipped { userId: number; date: string; start?: string; end?: string; reason: string }

const WEEKDAYS = [{ n: 1, label: 'Mon' }, { n: 2, label: 'Tue' }, { n: 3, label: 'Wed' }, { n: 4, label: 'Thu' }, { n: 5, label: 'Fri' }, { n: 6, label: 'Sat' }, { n: 0, label: 'Sun' }];
const selectClass = 'h-11 w-full rounded-md border border-input bg-white px-3 text-base md:h-10 md:text-sm';

// ----------------------------------------------------------------------------------------------- add shifts

interface TimeRow { key: number; start: string; end: string; label: string }

function AddShiftsDialog({ employees, templates, defaultFrom, defaultTo, onClose, onDone }: {
    employees: Employee[]; templates: Template[]; defaultFrom: string; defaultTo: string; onClose: () => void; onDone: () => void;
}) {
    const [search, setSearch] = useState('');
    const [department, setDepartment] = useState('');
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [from, setFrom] = useState(defaultFrom);
    const [to, setTo] = useState(defaultTo);
    const [weekdays, setWeekdays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
    const [times, setTimes] = useState<TimeRow[]>([{ key: 1, start: '08:00', end: '17:00', label: '' }]);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<{ created: number; skipped: Skipped[] } | null>(null);

    const departments = useMemo(() => [...new Set(employees.map((e) => e.department).filter(Boolean) as string[])].sort(), [employees]);
    const shown = useMemo(() => employees.filter((e) => (!department || e.department === department) && (!search.trim() || e.name.toLowerCase().includes(search.trim().toLowerCase()))), [employees, department, search]);
    const nameOf = (id: number) => employees.find((e) => e.id === id)?.name ?? `#${id}`;

    const toggle = (id: number) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const allShownSelected = shown.length > 0 && shown.every((e) => selected.has(e.id));
    const setRow = (key: number, patch: Partial<TimeRow>) => setTimes((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    const addRow = (start = '', end = '', label = '') => setTimes((rows) => [...rows, { key: Math.max(0, ...rows.map((r) => r.key)) + 1, start, end, label }]);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        if (selected.size === 0) return setError('Choose at least one person.');
        if (!from || !to) return setError('Choose the first and last date.');
        if (weekdays.size === 0) return setError('Choose at least one weekday.');
        if (times.some((t) => !t.start || !t.end)) return setError('Fill in every start and finish time, or remove the empty row.');
        setBusy(true);
        try {
            const r = await sendJson<{ created: number; skipped: Skipped[] }>('/api/hr/shifts', 'POST', {
                userIds: [...selected], range: { from, to, weekdays: [...weekdays] }, times: times.map((t) => ({ start: t.start, end: t.end, label: t.label || null })),
            });
            setResult(r);
            if (r.created > 0) toast.success(`${r.created} shift${r.created === 1 ? '' : 's'} added`);
            onDone();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(false);
        }
    }

    if (result) {
        const byReason = new Map<string, Skipped[]>();
        for (const s of result.skipped) byReason.set(s.reason, [...(byReason.get(s.reason) ?? []), s]);
        return (
            <Dialog open onOpenChange={(o) => !o && onClose()}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader><DialogTitle>{result.created} shift{result.created === 1 ? '' : 's'} added</DialogTitle><DialogDescription>{result.skipped.length > 0 ? `${result.skipped.length} could not be added:` : 'Everything was added.'}</DialogDescription></DialogHeader>
                    {[...byReason].map(([reason, list]) => (
                        <div key={reason} className="text-sm">
                            <p className="font-semibold text-neutral-900">{reason} ({list.length})</p>
                            <ul className="mt-1 max-h-40 list-inside list-disc overflow-y-auto text-neutral-700">
                                {list.slice(0, 40).map((s, i) => <li key={i}>{nameOf(s.userId)}, {formatDate(s.date)}{s.start ? ` ${s.start}-${s.end}` : ''}</li>)}
                                {list.length > 40 && <li>and {list.length - 40} more</li>}
                            </ul>
                        </div>
                    ))}
                    <DialogFooter><Button type="button" onClick={onClose}>Done</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
                <form onSubmit={submit} noValidate className="space-y-5">
                    <DialogHeader>
                        <DialogTitle>Add shifts</DialogTitle>
                        <DialogDescription>Choose who, which days, and one or more shifts. People already on leave, or with an overlapping shift, are skipped and listed afterwards.</DialogDescription>
                    </DialogHeader>
                    {error && <FormAlert>{error}</FormAlert>}

                    <fieldset className="space-y-2">
                        <legend className="text-sm font-semibold text-neutral-900">1. Who ({selected.size} selected)</legend>
                        <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
                            <Input aria-label="Search people" type="search" placeholder="Search by name" value={search} onChange={(e) => setSearch(e.target.value)} />
                            <select aria-label="Department" className={selectClass} value={department} onChange={(e) => setDepartment(e.target.value)}>
                                <option value="">All departments</option>{departments.map((d) => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <label className="flex min-h-10 items-center gap-2 text-sm font-medium text-neutral-800">
                            <input type="checkbox" className="h-4 w-4" checked={allShownSelected} onChange={() => setSelected((s) => { const n = new Set(s); if (allShownSelected) shown.forEach((e) => n.delete(e.id)); else shown.forEach((e) => n.add(e.id)); return n; })} />
                            Select everyone shown ({shown.length})
                        </label>
                        <ul tabIndex={0} aria-label="People" className="max-h-52 divide-y divide-neutral-100 overflow-y-auto rounded-lg border border-neutral-200">
                            {shown.map((e) => (
                                <li key={e.id}>
                                    <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 text-sm hover:bg-neutral-50">
                                        <input type="checkbox" className="h-4 w-4" checked={selected.has(e.id)} onChange={() => toggle(e.id)} />
                                        <span className="font-medium text-neutral-900">{e.name}</span>
                                        <span className="text-xs text-neutral-600">{ROLE_LABEL[e.role] ?? e.role}{e.department ? ` · ${e.department}` : ''}</span>
                                    </label>
                                </li>
                            ))}
                            {shown.length === 0 && <li className="px-3 py-4 text-sm text-neutral-600">Nobody matches.</li>}
                        </ul>
                    </fieldset>

                    <fieldset className="space-y-2">
                        <legend className="text-sm font-semibold text-neutral-900">2. Which days</legend>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5"><Label htmlFor="s-from">From</Label><Input id="s-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
                            <div className="space-y-1.5"><Label htmlFor="s-to">To</Label><Input id="s-to" type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} /></div>
                        </div>
                        <div role="group" aria-label="Weekdays" className="flex flex-wrap gap-1.5">
                            {WEEKDAYS.map((w) => (
                                <button key={w.n} type="button" aria-pressed={weekdays.has(w.n)} onClick={() => setWeekdays((s) => { const n = new Set(s); if (n.has(w.n)) n.delete(w.n); else n.add(w.n); return n; })}
                                    className={cn('min-h-11 min-w-12 rounded-lg border px-3 text-sm font-semibold', weekdays.has(w.n) ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-neutral-300 bg-white text-neutral-800')}>
                                    {w.label}
                                </button>
                            ))}
                        </div>
                    </fieldset>

                    <fieldset className="space-y-2">
                        <legend className="text-sm font-semibold text-neutral-900">3. Shifts each day</legend>
                        {templates.filter((t) => t.active).length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Presets">
                                <span className="text-xs text-neutral-600">Quick add:</span>
                                {templates.filter((t) => t.active).map((t) => (
                                    <button key={t.id} type="button" onClick={() => addRow(t.start, t.end, t.name)} className="min-h-10 rounded-full border border-neutral-300 bg-white px-3 text-sm text-neutral-800 hover:bg-emerald-50">
                                        {t.name} {t.start}-{t.end}
                                    </button>
                                ))}
                            </div>
                        )}
                        <ul className="space-y-2">
                            {times.map((t, i) => (
                                <li key={t.key} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 sm:grid-cols-[1fr_1fr_1.2fr_auto]">
                                    <div className="space-y-1"><Label htmlFor={`t-s-${t.key}`} className="text-xs">Starts</Label><Input id={`t-s-${t.key}`} type="time" value={t.start} onChange={(e) => setRow(t.key, { start: e.target.value })} /></div>
                                    <div className="space-y-1"><Label htmlFor={`t-e-${t.key}`} className="text-xs">Finishes</Label><Input id={`t-e-${t.key}`} type="time" value={t.end} onChange={(e) => setRow(t.key, { end: e.target.value })} /></div>
                                    <div className="col-span-3 space-y-1 sm:col-span-1"><Label htmlFor={`t-l-${t.key}`} className="text-xs">Label (optional)</Label><Input id={`t-l-${t.key}`} value={t.label} maxLength={60} onChange={(e) => setRow(t.key, { label: e.target.value })} /></div>
                                    <Button type="button" variant="ghost" className="h-11 w-11 p-0 text-neutral-600" aria-label={`Remove shift ${i + 1}`} disabled={times.length === 1} onClick={() => setTimes((rows) => rows.filter((r) => r.key !== t.key))}><X className="h-4 w-4" /></Button>
                                </li>
                            ))}
                        </ul>
                        <Button type="button" variant="outline" className="h-11 gap-2" onClick={() => addRow()}><Plus className="h-4 w-4" aria-hidden /> Add another shift on the same day</Button>
                        <p className="text-xs text-neutral-600">A finish time earlier than the start means the shift ends the next day (a night shift).</p>
                    </fieldset>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={busy}>{busy ? 'Adding…' : `Add shifts for ${selected.size} ${selected.size === 1 ? 'person' : 'people'}`}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ----------------------------------------------------------------------------------------------- edit one shift

function EditShiftDialog({ shift, name, onClose, onDone }: { shift: ShiftRow; name: string; onClose: () => void; onDone: () => void }) {
    const confirm = useConfirm();
    const [start, setStart] = useState(shift.start_time);
    const [end, setEnd] = useState(shift.end_time);
    const [label, setLabel] = useState(shift.label ?? '');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    async function save(e: React.FormEvent) {
        e.preventDefault();
        setError(''); setBusy(true);
        try { await sendJson(`/api/hr/shifts/${shift.id}`, 'PUT', { start, end, label: label || null }); toast.success('Shift updated'); onDone(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
    }
    async function remove() {
        if (!(await confirm({ title: 'Remove this shift?', description: `${name}, ${formatDate(shift.shift_date)}, ${shift.start_time}-${shift.end_time}.`, confirmLabel: 'Remove shift', cancelLabel: 'Keep it', destructive: true }))) return;
        try {
            const r = await sendJson<{ removed: number; kept: number }>('/api/hr/shifts', 'DELETE', { ids: [shift.id] });
            if (r.removed === 0) toast.error('That shift has attendance recorded against it, so it was kept.'); else toast.success('Shift removed');
            onDone();
        } catch (err) { toast.error((err as Error).message); }
    }

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <form onSubmit={save} noValidate className="space-y-4">
                    <DialogHeader><DialogTitle>{name}</DialogTitle><DialogDescription>{formatDate(shift.shift_date)}</DialogDescription></DialogHeader>
                    {error && <FormAlert>{error}</FormAlert>}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5"><Label htmlFor="es-s">Starts</Label><Input id="es-s" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
                        <div className="space-y-1.5"><Label htmlFor="es-e">Finishes</Label><Input id="es-e" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
                    </div>
                    <div className="space-y-1.5"><Label htmlFor="es-l">Label (optional)</Label><Input id="es-l" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} /></div>
                    <DialogFooter className="gap-2 sm:justify-between">
                        <Button type="button" variant="ghost" className="gap-2 text-red-700 hover:bg-red-50" onClick={remove}><Trash2 className="h-4 w-4" aria-hidden /> Remove</Button>
                        <div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button></div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ----------------------------------------------------------------------------------------------- page

export default function RosterPage() {
    const confirm = useConfirm();
    const [monday, setMonday] = useState(() => mondayOf(todayGuess()));
    const [department, setDepartment] = useState('');
    const [adding, setAdding] = useState(false);
    const [editing, setEditing] = useState<ShiftRow | null>(null);
    const sunday = addDaysText(monday, 6);
    const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysText(monday, i)), [monday]);

    const roster = useApi<Roster>(`/api/hr/shifts?from=${monday}&to=${sunday}`);
    const emps = useApi<{ employees: Employee[] }>('/api/hr/employees');
    const templates = useApi<{ templates: Template[] }>('/api/hr/shift-templates');

    const people = (emps.data?.employees ?? []).filter((e) => !department || e.department === department);
    const departments = [...new Set((emps.data?.employees ?? []).map((e) => e.department).filter(Boolean) as string[])].sort();
    const holidayOn = (d: string) => roster.data?.holidays.find((h) => h.date === d);
    const leaveOn = (uid: number, d: string) => roster.data?.leave.find((l) => l.userId === uid && l.start <= d && l.end >= d);
    const shiftsOn = (uid: number, d: string) => (roster.data?.shifts ?? []).filter((s) => s.user_id === uid && s.shift_date === d);

    async function copyToNext() {
        if (!(await confirm({ title: 'Copy this week to next week?', description: `Every shift from ${formatDate(monday)} onwards is repeated a week later. Shifts that clash, or fall on approved leave, are skipped.`, confirmLabel: 'Copy week', cancelLabel: 'Cancel' }))) return;
        try {
            const r = await sendJson<{ created: number; skipped: unknown[] }>('/api/hr/shifts/copy-week', 'POST', { fromMonday: monday, toMonday: addDaysText(monday, 7) });
            toast.success(`${r.created} shift${r.created === 1 ? '' : 's'} copied`, { description: r.skipped.length ? `${r.skipped.length} skipped (clash or leave).` : undefined });
            setMonday(addDaysText(monday, 7));
        } catch (err) { toast.error((err as Error).message); }
    }

    const refresh = () => { roster.reload(); };

    return (
        <div className="space-y-5">
            <PageHeader
                title="Roster"
                description="Who works when. Add shifts for one person or many, with as many shifts a day as you need."
                actions={<>
                    <Button type="button" variant="outline" className="h-11 gap-2" onClick={copyToNext}><Copy className="h-4 w-4" aria-hidden /> Copy to next week</Button>
                    <Button type="button" className="h-11 gap-2" onClick={() => setAdding(true)}><CalendarPlus className="h-4 w-4" aria-hidden /> Add shifts</Button>
                </>}
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                    <Button type="button" variant="outline" className="h-11 w-11 p-0" aria-label="Previous week" onClick={() => setMonday(addDaysText(monday, -7))}><ChevronLeft className="h-4 w-4" /></Button>
                    <p className="min-w-44 text-center text-sm font-semibold text-neutral-900" aria-live="polite">{formatDate(monday)} to {formatDate(sunday)}</p>
                    <Button type="button" variant="outline" className="h-11 w-11 p-0" aria-label="Next week" onClick={() => setMonday(addDaysText(monday, 7))}><ChevronRight className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" className="h-11" onClick={() => setMonday(mondayOf(todayGuess()))}>This week</Button>
                </div>
                <select aria-label="Department" className="h-11 rounded-md border border-input bg-white px-3 text-base md:text-sm" value={department} onChange={(e) => setDepartment(e.target.value)}>
                    <option value="">All departments</option>{departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
            </div>

            {(roster.loading && !roster.data) || (emps.loading && !emps.data) ? <LoadingState label="Loading the roster…" /> : roster.error || emps.error || !roster.data ? (
                <ErrorState title="Could not load the roster" description={roster.error ?? emps.error ?? undefined} onRetry={() => { roster.reload(); emps.reload(); }} />
            ) : people.length === 0 ? (
                <EmptyState title="No employees to schedule" description="Staff accounts are created under Admin, User Management." />
            ) : (
                <>
                    {/* Larger screens: the week as a grid */}
                    <div tabIndex={0} role="region" aria-label="Weekly roster" className="hidden overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-[var(--shadow-card)] md:block">
                        <table className="w-full min-w-[900px] border-collapse text-sm">
                            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                                <tr>
                                    <th scope="col" className="sticky left-0 z-10 w-48 bg-neutral-50 px-3 py-2.5">Employee</th>
                                    {days.map((d) => (
                                        <th key={d} scope="col" className="px-2 py-2.5">{dayText(d)}{holidayOn(d) && <span className="block text-[10px] font-medium normal-case text-sky-800">{holidayOn(d)!.name}</span>}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {people.map((p) => (
                                    <tr key={p.id} className="align-top">
                                        <th scope="row" className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-medium text-neutral-900">{p.name}<span className="block text-xs font-normal text-neutral-600">{ROLE_LABEL[p.role] ?? p.role}</span></th>
                                        {days.map((d) => {
                                            const leave = leaveOn(p.id, d);
                                            return (
                                                <td key={d} className="space-y-1 px-1.5 py-2">
                                                    {leave && <span className={cn('block rounded px-1.5 py-0.5 text-[11px] font-semibold', leave.status === 'APPROVED' ? 'bg-sky-100 text-sky-900' : 'bg-amber-100 text-amber-900')}>{leave.status === 'APPROVED' ? leave.type : `${leave.type}?`}</span>}
                                                    {shiftsOn(p.id, d).map((s) => (
                                                        <button key={s.id} type="button" onClick={() => setEditing(s)} className="block min-h-8 w-full rounded border border-emerald-200 bg-emerald-50 px-1.5 text-left text-xs font-medium text-emerald-900 tabular hover:bg-emerald-100" aria-label={`${p.name}, ${dayText(d)}, ${s.start_time} to ${s.end_time}. Edit`}>
                                                            {s.start_time}-{s.end_time}{s.label ? ` ${s.label}` : ''}
                                                        </button>
                                                    ))}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Phones: one card per person */}
                    <ul className="space-y-2.5 md:hidden">
                        {people.map((p) => (
                            <li key={p.id} className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-[var(--shadow-card)]">
                                <p className="font-semibold text-neutral-900">{p.name} <span className="text-xs font-normal text-neutral-600">{ROLE_LABEL[p.role] ?? p.role}</span></p>
                                <ul className="mt-2 space-y-1">
                                    {days.map((d) => {
                                        const list = shiftsOn(p.id, d), leave = leaveOn(p.id, d);
                                        return (
                                            <li key={d} className="flex items-start gap-2 text-sm">
                                                <span className="w-20 shrink-0 text-neutral-700">{dayText(d)}</span>
                                                <span className="flex flex-wrap gap-1">
                                                    {leave && <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs font-semibold text-sky-900">{leave.type}</span>}
                                                    {list.map((s) => <button key={s.id} type="button" onClick={() => setEditing(s)} className="min-h-9 rounded border border-emerald-200 bg-emerald-50 px-2 text-xs font-medium text-emerald-900 tabular">{s.start_time}-{s.end_time}</button>)}
                                                    {list.length === 0 && !leave && <span className="text-neutral-500">{holidayOn(d) ? holidayOn(d)!.name : 'Off'}</span>}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </li>
                        ))}
                    </ul>
                </>
            )}

            {adding && emps.data && (
                <AddShiftsDialog
                    employees={emps.data.employees.filter((e) => e.status === 'ACTIVE')} templates={templates.data?.templates ?? []}
                    defaultFrom={monday} defaultTo={sunday} onClose={() => setAdding(false)} onDone={refresh}
                />
            )}
            {editing && <EditShiftDialog shift={editing} name={emps.data?.employees.find((e) => e.id === editing.user_id)?.name ?? 'Shift'} onClose={() => setEditing(null)} onDone={() => { setEditing(null); refresh(); }} />}
        </div>
    );
}
