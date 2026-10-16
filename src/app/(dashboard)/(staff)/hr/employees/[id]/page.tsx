'use client';

import { use, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { ErrorState, LoadingState } from '@/components/ui/state-views';
import { FormAlert } from '@/components/ui/text-field';
import { usePrompt } from '@/components/ui/confirm-dialog';
import { sendJson, useApi } from '@/hooks/useApi';
import { ROLE_LABEL, clockText, dayText, minutesText, monthText, shiftMonth } from '@/lib/hr-format';

interface Employee { id: number; name: string; email: string; phone: string | null; role: string; employeeNo: string | null; department: string | null; designation: string | null; joinDate: string | null; status: 'ACTIVE' | 'INACTIVE' }
interface Balance { typeId: number; name: string; unlimited: boolean; entitled: number; used: number; pending: number; remaining: number }
interface Att {
    timezone: string; employees: { id: number; days: { day: string; status: string; workedMinutes: number; lateMinutes: number; shifts: { start: string; end: string }[]; punches: { id: number; clockIn: string; clockOut: string | null }[] }[]; summary: { presentDays: number; lateDays: number; absentDays: number; workedMinutes: number } }[];
}

function monthBounds(month: string) {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

export default function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const askText = usePrompt();
    const { data, loading, error, reload } = useApi<{ employee: Employee; balances: Balance[]; year: number }>(`/api/hr/employees/${id}`);
    const [form, setForm] = useState({ employeeNo: '', department: '', designation: '', joinDate: '', status: 'ACTIVE' });
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);
    const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const b = monthBounds(month);
    const att = useApi<Att>(`/api/hr/attendance?userId=${id}&from=${b.from}&to=${b.to}`);

    useEffect(() => {
        if (data) setForm({ employeeNo: data.employee.employeeNo ?? '', department: data.employee.department ?? '', designation: data.employee.designation ?? '', joinDate: data.employee.joinDate ?? '', status: data.employee.status });
    }, [data]);

    async function save(e: React.FormEvent) {
        e.preventDefault();
        setFormError(''); setSaving(true);
        try {
            await sendJson(`/api/hr/employees/${id}`, 'PUT', { employeeNo: form.employeeNo || null, department: form.department || null, designation: form.designation || null, joinDate: form.joinDate || null, status: form.status });
            toast.success('Employee saved');
            reload();
        } catch (err) {
            setFormError((err as Error).message);
        } finally {
            setSaving(false);
        }
    }

    async function setAllowance(typeId: number, current: number) {
        const value = await askText({ title: 'Leave allowance', label: 'Days for this year (leave empty to use the default)', defaultValue: String(current), placeholder: 'For example 14 or 7.5', confirmLabel: 'Save allowance' });
        if (value === null) return;
        const days = value.trim() === '' ? null : Number(value);
        if (days !== null && (!Number.isFinite(days) || days < 0)) return toast.error('Enter a number of days, in halves (for example 7 or 7.5).');
        try { await sendJson('/api/hr/entitlements', 'PUT', { userId: Number(id), leaveTypeId: typeId, year: data!.year, days }); toast.success('Allowance saved'); reload(); } catch (err) { toast.error((err as Error).message); }
    }

    if (loading && !data) return <LoadingState label="Loading employee…" />;
    if (error || !data) return <ErrorState title="Could not load this employee" description={error ?? undefined} onRetry={reload} />;
    const e = data.employee;
    const person = att.data?.employees[0];

    return (
        <div className="space-y-6">
            <PageHeader back={{ href: '/hr/employees', label: 'Employees' }} title={e.name} description={`${ROLE_LABEL[e.role] ?? e.role} · ${e.email}${e.phone ? ` · ${e.phone}` : ''}`} />

            <form onSubmit={save} noValidate className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-[var(--shadow-card)] sm:p-5" aria-label="HR profile">
                <h2 className="text-base font-semibold text-neutral-900">HR profile</h2>
                {formError && <FormAlert>{formError}</FormAlert>}
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label htmlFor="e-no">Employee number</Label><Input id="e-no" value={form.employeeNo} onChange={(ev) => setForm({ ...form, employeeNo: ev.target.value })} /></div>
                    <div className="space-y-1.5"><Label htmlFor="e-join">Join date</Label><Input id="e-join" type="date" value={form.joinDate} onChange={(ev) => setForm({ ...form, joinDate: ev.target.value })} /></div>
                    <div className="space-y-1.5"><Label htmlFor="e-dept">Department</Label><Input id="e-dept" value={form.department} onChange={(ev) => setForm({ ...form, department: ev.target.value })} /></div>
                    <div className="space-y-1.5"><Label htmlFor="e-des">Designation</Label><Input id="e-des" value={form.designation} onChange={(ev) => setForm({ ...form, designation: ev.target.value })} /></div>
                    <div className="space-y-1.5">
                        <Label htmlFor="e-status">Status</Label>
                        <select id="e-status" className="h-11 w-full rounded-md border border-input bg-white px-3 text-base md:h-10 md:text-sm" value={form.status} onChange={(ev) => setForm({ ...form, status: ev.target.value })}>
                            <option value="ACTIVE">Active</option><option value="INACTIVE">Inactive (no new shifts)</option>
                        </select>
                    </div>
                </div>
                <Button type="submit" disabled={saving} className="h-11 w-full sm:w-auto">{saving ? 'Saving…' : 'Save profile'}</Button>
            </form>

            <section aria-labelledby="bal" className="space-y-2">
                <h2 id="bal" className="text-base font-semibold text-neutral-900">Leave balance, {data.year}</h2>
                <ul className="grid gap-2 sm:grid-cols-3">
                    {data.balances.map((bal) => (
                        <li key={bal.typeId} className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-[var(--shadow-card)]">
                            <p className="text-sm font-medium text-neutral-700">{bal.name}</p>
                            <p className="mt-1 text-2xl font-bold text-neutral-900 tabular">{bal.unlimited ? 'No limit' : bal.remaining}<span className="text-sm font-normal text-neutral-600">{bal.unlimited ? '' : ` of ${bal.entitled} left`}</span></p>
                            <p className="text-xs text-neutral-600">{bal.used} used{bal.pending ? `, ${bal.pending} pending` : ''}</p>
                            {!bal.unlimited && <Button type="button" variant="ghost" size="sm" className="-ml-2 mt-1 h-10 text-emerald-800" onClick={() => setAllowance(bal.typeId, bal.entitled)}>Change allowance</Button>}
                        </li>
                    ))}
                </ul>
            </section>

            <section aria-labelledby="hist" className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <h2 id="hist" className="text-base font-semibold text-neutral-900">Attendance, {monthText(month)}</h2>
                    <div className="flex gap-1.5">
                        <Button type="button" variant="outline" className="h-11" onClick={() => setMonth(shiftMonth(month, -1))}>Previous</Button>
                        <Button type="button" variant="outline" className="h-11" onClick={() => setMonth(shiftMonth(month, 1))}>Next</Button>
                    </div>
                </div>
                {att.loading && !att.data ? <LoadingState label="Loading…" /> : att.error || !person ? <ErrorState title="Could not load attendance" description={att.error ?? undefined} onRetry={att.reload} /> : (
                    <>
                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                            <StatCard compact label="Present" value={person.summary.presentDays} /><StatCard compact label="Late" value={person.summary.lateDays} tone="warning" />
                            <StatCard compact label="Absent" value={person.summary.absentDays} tone={person.summary.absentDays ? 'danger' : 'neutral'} /><StatCard compact label="Worked" value={minutesText(person.summary.workedMinutes)} tone="info" />
                        </div>
                        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[var(--shadow-card)]">
                            {person.days.filter((d) => d.status !== 'DAY_OFF' || d.punches.length > 0).reverse().map((d) => (
                                <li key={d.day} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                                    <span className="font-medium text-neutral-900">{dayText(d.day)}</span>
                                    <span className="text-neutral-700 tabular">{d.punches.map((p) => `${clockText(p.clockIn, att.data!.timezone)}-${p.clockOut ? clockText(p.clockOut, att.data!.timezone) : '...'}`).join(', ') || d.shifts.map((s) => `${s.start}-${s.end}`).join(', ')}</span>
                                    <StatusBadge status={d.status} kind="attendance" size="sm" />
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </section>
        </div>
    );
}
