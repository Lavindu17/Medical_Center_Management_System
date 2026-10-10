'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorState, LoadingState } from '@/components/ui/state-views';
import { FormAlert } from '@/components/ui/text-field';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { sendJson, useApi } from '@/hooks/useApi';
import { formatDate } from '@/lib/dates';

const field = 'h-11 w-full rounded-md border border-input bg-white px-3 text-base md:h-10 md:text-sm';

// ------------------------------------------------------------------------------------------------ general

function General() {
    const { data, loading, error, reload } = useApi<{ settings: { timezone: string; graceMinutes: number; earlyWindowMinutes: number; missingClockOutHours: number } }>('/api/hr/settings');
    const [s, setS] = useState({ timezone: '', graceMinutes: '10', earlyWindowMinutes: '180', missingClockOutHours: '16' });
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => { if (data) setS({ timezone: data.settings.timezone, graceMinutes: String(data.settings.graceMinutes), earlyWindowMinutes: String(data.settings.earlyWindowMinutes), missingClockOutHours: String(data.settings.missingClockOutHours) }); }, [data]);

    async function save(e: React.FormEvent) {
        e.preventDefault();
        setErr(''); setBusy(true);
        try { await sendJson('/api/hr/settings', 'PUT', { timezone: s.timezone, graceMinutes: Number(s.graceMinutes), earlyWindowMinutes: Number(s.earlyWindowMinutes), missingClockOutHours: Number(s.missingClockOutHours) }); toast.success('Settings saved'); reload(); } catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
    }
    if (loading && !data) return <LoadingState label="Loading…" />;
    if (error || !data) return <ErrorState title="Could not load settings" description={error ?? undefined} onRetry={reload} />;
    return (
        <form onSubmit={save} noValidate className="max-w-xl space-y-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-[var(--shadow-card)] sm:p-5">
            {err && <FormAlert>{err}</FormAlert>}
            <div className="space-y-1.5"><Label htmlFor="g-tz">Clinic time zone</Label><Input id="g-tz" value={s.timezone} onChange={(e) => setS({ ...s, timezone: e.target.value })} /><p className="text-xs text-neutral-600">Shifts are written in this zone, for example Asia/Colombo.</p></div>
            <div className="space-y-1.5"><Label htmlFor="g-grace">Grace period (minutes)</Label><Input id="g-grace" inputMode="numeric" value={s.graceMinutes} onChange={(e) => setS({ ...s, graceMinutes: e.target.value })} /><p className="text-xs text-neutral-600">Arriving or leaving within this many minutes of the shift is not marked late or early.</p></div>
            <div className="space-y-1.5"><Label htmlFor="g-win">Match a punch to a shift within (minutes)</Label><Input id="g-win" inputMode="numeric" value={s.earlyWindowMinutes} onChange={(e) => setS({ ...s, earlyWindowMinutes: e.target.value })} /><p className="text-xs text-neutral-600">A punch further than this from any shift is marked unscheduled.</p></div>
            <div className="space-y-1.5"><Label htmlFor="g-miss">Missing clock-out after (hours)</Label><Input id="g-miss" inputMode="numeric" value={s.missingClockOutHours} onChange={(e) => setS({ ...s, missingClockOutHours: e.target.value })} /><p className="text-xs text-neutral-600">A session left open this long is shown as missing its clock-out and no longer blocks the next clock-in.</p></div>
            <Button type="submit" disabled={busy} className="h-11 w-full sm:w-auto">{busy ? 'Saving…' : 'Save settings'}</Button>
        </form>
    );
}

// ------------------------------------------------------------------------------------------------ presets

interface Template { id: number; name: string; start: string; end: string; active: number }

function Presets() {
    const { data, loading, error, reload } = useApi<{ templates: Template[] }>('/api/hr/shift-templates');
    const [form, setForm] = useState({ name: '', start: '', end: '' });
    const [err, setErr] = useState('');
    async function add(e: React.FormEvent) {
        e.preventDefault();
        setErr('');
        try { await sendJson('/api/hr/shift-templates', 'POST', { name: form.name, start: form.start, end: form.end, active: true }); setForm({ name: '', start: '', end: '' }); toast.success('Preset added'); reload(); } catch (e2) { setErr((e2 as Error).message); }
    }
    async function toggle(t: Template) {
        try { await sendJson('/api/hr/shift-templates', 'POST', { id: t.id, name: t.name, start: t.start, end: t.end, active: !t.active }); reload(); } catch (e2) { toast.error((e2 as Error).message); }
    }
    if (loading && !data) return <LoadingState label="Loading…" />;
    if (error || !data) return <ErrorState title="Could not load presets" description={error ?? undefined} onRetry={reload} />;
    return (
        <div className="max-w-xl space-y-4">
            <p className="text-sm text-neutral-700">Presets are quick-fill buttons in the Add shifts form. A shift is always just a start and finish time, so you are never limited to these.</p>
            <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[var(--shadow-card)]">
                {data.templates.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                        <span className={t.active ? 'font-medium text-neutral-900' : 'text-neutral-500 line-through'}>{t.name}  {t.start}-{t.end}</span>
                        <Button type="button" variant="ghost" size="sm" className="h-10" onClick={() => toggle(t)}>{t.active ? 'Switch off' : 'Switch on'}</Button>
                    </li>
                ))}
            </ul>
            <form onSubmit={add} noValidate className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-[var(--shadow-card)]">
                <h3 className="text-sm font-semibold text-neutral-900">New preset</h3>
                {err && <FormAlert>{err}</FormAlert>}
                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5"><Label htmlFor="p-name">Name</Label><Input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label htmlFor="p-s">Starts</Label><Input id="p-s" type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label htmlFor="p-e">Finishes</Label><Input id="p-e" type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></div>
                </div>
                <Button type="submit" className="h-11 gap-2"><Plus className="h-4 w-4" aria-hidden /> Add preset</Button>
            </form>
        </div>
    );
}

// ------------------------------------------------------------------------------------------------ leave types

interface LeaveType { id: number; code: string; name: string; days_per_year: number; paid: number; allows_half_day: number; unlimited: number; active: number; sort_order: number }

function LeaveTypes() {
    const { data, loading, error, reload } = useApi<{ types: LeaveType[] }>('/api/hr/leave-types');
    const empty = { code: '', name: '', daysPerYear: '0', paid: true, allowsHalfDay: true, unlimited: false };
    const [form, setForm] = useState(empty);
    const [err, setErr] = useState('');

    async function save(t: LeaveType, patch: Partial<{ daysPerYear: number; active: boolean }>) {
        try {
            await sendJson('/api/hr/leave-types', 'POST', { id: t.id, code: t.code, name: t.name, daysPerYear: patch.daysPerYear ?? Number(t.days_per_year), paid: !!t.paid, allowsHalfDay: !!t.allows_half_day, unlimited: !!t.unlimited, active: patch.active ?? !!t.active, sortOrder: t.sort_order });
            reload();
        } catch (e) { toast.error((e as Error).message); }
    }
    async function add(e: React.FormEvent) {
        e.preventDefault();
        setErr('');
        try { await sendJson('/api/hr/leave-types', 'POST', { code: form.code, name: form.name, daysPerYear: Number(form.daysPerYear), paid: form.paid, allowsHalfDay: form.allowsHalfDay, unlimited: form.unlimited, active: true, sortOrder: (data?.types.length ?? 0) + 1 }); setForm(empty); toast.success('Leave type added'); reload(); } catch (e2) { setErr((e2 as Error).message); }
    }
    if (loading && !data) return <LoadingState label="Loading…" />;
    if (error || !data) return <ErrorState title="Could not load leave types" description={error ?? undefined} onRetry={reload} />;
    return (
        <div className="max-w-2xl space-y-4">
            <FormAlert tone="info">The default allowances are placeholders. Check them against the Shop and Office Employees Act (or your Wages Board order) before relying on them, then edit them here.</FormAlert>
            <ul className="space-y-2">
                {data.types.map((t) => (
                    <li key={t.id} className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-[var(--shadow-card)]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className={t.active ? 'font-semibold text-neutral-900' : 'font-semibold text-neutral-500 line-through'}>{t.name} <span className="text-xs font-normal text-neutral-600">{t.code}</span></p>
                            <div className="flex items-center gap-2">
                                {!t.unlimited && (
                                    <label className="flex items-center gap-1.5 text-sm text-neutral-700">Days a year
                                        <Input aria-label={`${t.name} days a year`} className="h-10 w-20" inputMode="decimal" defaultValue={String(t.days_per_year)}
                                            onBlur={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n !== Number(t.days_per_year)) save(t, { daysPerYear: n }); }} />
                                    </label>
                                )}
                                <Button type="button" variant="ghost" size="sm" className="h-10" onClick={() => save(t, { active: !t.active })}>{t.active ? 'Switch off' : 'Switch on'}</Button>
                            </div>
                        </div>
                        <p className="mt-1 text-xs text-neutral-600">{t.paid ? 'Paid' : 'Unpaid'} · {t.allows_half_day ? 'half days allowed' : 'whole days only'} · {t.unlimited ? 'no balance limit' : 'limited by the allowance'}</p>
                    </li>
                ))}
            </ul>
            <form onSubmit={add} noValidate className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-[var(--shadow-card)]">
                <h3 className="text-sm font-semibold text-neutral-900">New leave type</h3>
                {err && <FormAlert>{err}</FormAlert>}
                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5"><Label htmlFor="lt-name">Name</Label><Input id="lt-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label htmlFor="lt-code">Code</Label><Input id="lt-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SICK" /></div>
                    <div className="space-y-1.5"><Label htmlFor="lt-days">Days a year</Label><Input id="lt-days" inputMode="decimal" value={form.daysPerYear} onChange={(e) => setForm({ ...form, daysPerYear: e.target.value })} /></div>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-neutral-800">
                    <label className="flex min-h-10 items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.checked })} /> Paid</label>
                    <label className="flex min-h-10 items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={form.allowsHalfDay} onChange={(e) => setForm({ ...form, allowsHalfDay: e.target.checked })} /> Half days allowed</label>
                    <label className="flex min-h-10 items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={form.unlimited} onChange={(e) => setForm({ ...form, unlimited: e.target.checked })} /> No balance limit</label>
                </div>
                <Button type="submit" className="h-11 gap-2"><Plus className="h-4 w-4" aria-hidden /> Add leave type</Button>
            </form>
        </div>
    );
}

// ------------------------------------------------------------------------------------------------ holidays

function Holidays() {
    const confirm = useConfirm();
    const [year, setYear] = useState(new Date().getFullYear());
    const { data, loading, error, reload } = useApi<{ holidays: { date: string; name: string }[] }>(`/api/hr/holidays?year=${year}`);
    const [form, setForm] = useState({ date: '', name: '' });
    const [err, setErr] = useState('');

    async function add(e: React.FormEvent) {
        e.preventDefault();
        setErr('');
        try { await sendJson('/api/hr/holidays', 'POST', form); setForm({ date: '', name: '' }); toast.success('Holiday saved'); reload(); } catch (e2) { setErr((e2 as Error).message); }
    }
    async function remove(d: string, name: string) {
        if (!(await confirm({ title: `Remove ${name}?`, description: `${formatDate(d)} will be counted as a normal day again.`, confirmLabel: 'Remove', cancelLabel: 'Keep', destructive: true }))) return;
        try { await sendJson(`/api/hr/holidays?date=${d}`, 'DELETE'); reload(); } catch (e2) { toast.error((e2 as Error).message); }
    }
    return (
        <div className="max-w-xl space-y-4">
            <p className="text-sm text-neutral-700">Public holidays are not charged as leave and are not counted as absences. Poya days and other holidays vary each year, so add them here.</p>
            <div className="flex items-center gap-2">
                <Button type="button" variant="outline" className="h-11" onClick={() => setYear(year - 1)}>{year - 1}</Button>
                <span className="px-2 text-base font-semibold text-neutral-900">{year}</span>
                <Button type="button" variant="outline" className="h-11" onClick={() => setYear(year + 1)}>{year + 1}</Button>
            </div>
            {loading && !data ? <LoadingState label="Loading…" /> : error || !data ? <ErrorState title="Could not load holidays" description={error ?? undefined} onRetry={reload} /> : (
                <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[var(--shadow-card)]">
                    {data.holidays.map((h) => (
                        <li key={h.date} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                            <span><span className="font-medium text-neutral-900">{formatDate(h.date)}</span> {h.name}</span>
                            <Button type="button" variant="ghost" size="sm" className="h-10 text-red-700" aria-label={`Remove ${h.name}`} onClick={() => remove(h.date, h.name)}><Trash2 className="h-4 w-4" /></Button>
                        </li>
                    ))}
                    {data.holidays.length === 0 && <li className="px-4 py-4 text-sm text-neutral-600">No holidays added for {year}.</li>}
                </ul>
            )}
            <form onSubmit={add} noValidate className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-[var(--shadow-card)]">
                <h3 className="text-sm font-semibold text-neutral-900">Add a holiday</h3>
                {err && <FormAlert>{err}</FormAlert>}
                <div className="grid gap-3 sm:grid-cols-[170px_1fr]">
                    <div className="space-y-1.5"><Label htmlFor="h-d">Date</Label><Input id="h-d" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label htmlFor="h-n">Name</Label><Input id="h-n" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                </div>
                <Button type="submit" className="h-11 gap-2"><Plus className="h-4 w-4" aria-hidden /> Add holiday</Button>
            </form>
        </div>
    );
}

export default function HrSettingsPage() {
    const [tab, setTab] = useState('general');
    return (
        <div className="space-y-5">
            <PageHeader title="HR settings" description="Rules for attendance, shift presets, leave types and public holidays." />
            <SegmentedTabs label="Settings sections" value={tab} onChange={setTab} items={[{ value: 'general', label: 'Attendance rules' }, { value: 'presets', label: 'Shift presets' }, { value: 'leave', label: 'Leave types' }, { value: 'holidays', label: 'Holidays' }]} />
            {tab === 'general' && <General />}
            {tab === 'presets' && <Presets />}
            {tab === 'leave' && <LeaveTypes />}
            {tab === 'holidays' && <Holidays />}
        </div>
    );
}
