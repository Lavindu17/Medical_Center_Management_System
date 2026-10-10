'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Download, ScrollText, ShieldCheck, ShieldAlert, Filter } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state-views';
import { FormAlert } from '@/components/ui/text-field';
import { formatDateTime } from '@/lib/dates';
import { cn } from '@/lib/utils';

interface Row {
    id: number;
    occurred_at: string;
    actor_id: number | null;
    actor_role: string | null;
    actor_name: string | null;
    on_behalf_of_id: number | null;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    patient_id: number | null;
    patient_name: string | null;
    outcome: 'SUCCESS' | 'DENIED' | 'FAILURE';
    ip: string | null;
    details: string | null;
}

interface Verification { ok: boolean; checked: number; head: string | null; firstBadId?: number; reason?: string }

const ACTIONS = ['LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGE', 'PASSWORD_RESET', 'ACCOUNT_SWITCH', 'VIEW', 'SEARCH', 'DOWNLOAD', 'EXPORT', 'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'DISPENSE', 'REJECT', 'ACCESS_DENIED', 'VERIFY_CHAIN'];
const ENTITIES = ['PATIENT_CHART', 'PATIENT_PROFILE', 'APPOINTMENT', 'CONSULTATION', 'PRESCRIPTION', 'LAB_REPORT', 'LAB_TEST', 'BILL', 'FAMILY_LINK', 'USER', 'MEDICINE', 'BATCH', 'DOCTOR_PROFILE', 'DOCTOR_LEAVE', 'EMPLOYEE', 'SHIFT', 'ATTENDANCE', 'CORRECTION', 'LEAVE_REQUEST', 'LEAVE_TYPE', 'HOLIDAY', 'HR_SETTINGS', 'SESSION', 'AUDIT_LOG'];

const label = (v: string | null) => (v ? v.toLowerCase().replace(/_/g, ' ') : '-');

const OUTCOME_STYLE: Record<Row['outcome'], string> = {
    SUCCESS: 'border-emerald-200 bg-success-soft text-success',
    DENIED: 'border-amber-200 bg-warning-soft text-warning',
    FAILURE: 'border-red-200 bg-danger-soft text-danger',
};

function detailsText(raw: string | null) {
    if (!raw) return '';
    try {
        return Object.entries(JSON.parse(raw)).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`).join(' · ');
    } catch {
        return raw;
    }
}

function who(r: Row) {
    const name = r.actor_name ?? (r.actor_id ? `User #${r.actor_id}` : 'Not signed in');
    return r.on_behalf_of_id ? `${name} (acting as account #${r.on_behalf_of_id})` : name;
}

export default function AuditLogPage() {
    const [filters, setFilters] = useState({ from: '', to: '', action: '', entity: '', outcome: '', patient: '', actor: '' });
    const [applied, setApplied] = useState(filters);
    const [rows, setRows] = useState<Row[]>([]);
    const [cursor, setCursor] = useState<number | null>(null);
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [loadingMore, setLoadingMore] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [verification, setVerification] = useState<Verification | null>(null);
    const [showFilters, setShowFilters] = useState(false);   // phones: collapsed so the entries are not pushed off screen

    const query = useCallback((f: typeof filters, before?: number | null) => {
        const p = new URLSearchParams();
        for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
        if (before) p.set('cursor', String(before));
        return p.toString();
    }, []);

    const load = useCallback(async (f: typeof filters, append = false, before?: number | null) => {
        if (append) setLoadingMore(true); else setState('loading');
        try {
            const res = await fetch(`/api/admin/audit?${query(f, before)}`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            setRows((prev) => (append ? [...prev, ...data.rows] : data.rows));
            setCursor(data.nextCursor);
            setState('ready');
        } catch {
            if (append) toast.error('Could not load more rows.'); else setState('error');
        } finally {
            setLoadingMore(false);
        }
    }, [query]);

    useEffect(() => { load(applied); }, [applied, load]);

    const exportHref = useMemo(() => `/api/admin/audit/export?${query(applied)}`, [applied, query]);

    async function verify() {
        setVerifying(true);
        setVerification(null);
        try {
            const res = await fetch('/api/admin/audit/verify', { method: 'POST' });
            if (!res.ok) throw new Error();
            setVerification(await res.json());
        } catch {
            toast.error('Could not check the audit log.');
        } finally {
            setVerifying(false);
        }
    }

    const set = (key: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFilters((f) => ({ ...f, [key]: e.target.value }));
    const selectClass = 'h-11 w-full rounded-md border border-input bg-white px-3 text-base md:h-10 md:text-sm';

    return (
        <div className="space-y-6">
            <PageHeader
                title="Audit log"
                description="Who did what to which record, and when. Rows cannot be edited or deleted, and the whole trail can be checked for tampering."
                actions={
                    <>
                        <Button variant="outline" onClick={verify} disabled={verifying} className="gap-2">
                            <ShieldCheck className="h-4 w-4" aria-hidden /> {verifying ? 'Checking…' : 'Check integrity'}
                        </Button>
                        <Button asChild variant="outline" className="gap-2">
                            <a href={exportHref}><Download className="h-4 w-4" aria-hidden /> Export CSV</a>
                        </Button>
                    </>
                }
            />

            {verification && (
                verification.ok ? (
                    <FormAlert tone="success">
                        <p className="font-medium">No tampering found in {verification.checked.toLocaleString()} rows.</p>
                        {verification.head && (
                            <p className="mt-1 break-all text-xs">
                                Latest fingerprint: <code>{verification.head}</code>. Keep a copy outside this system: it is the only way to notice rows removed from the end.
                            </p>
                        )}
                    </FormAlert>
                ) : (
                    <FormAlert tone="error">
                        <p className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4" aria-hidden /> The audit log has been altered.</p>
                        <p className="mt-1 text-sm">{verification.reason} First bad row: #{verification.firstBadId}. Treat this as a security incident.</p>
                    </FormAlert>
                )
            )}

            <Button
                type="button" variant="outline" className="w-full gap-2 md:hidden" aria-expanded={showFilters} aria-controls="audit-filters"
                onClick={() => setShowFilters((v) => !v)}
            >
                <Filter className="h-4 w-4" aria-hidden /> {showFilters ? 'Hide filters' : 'Filters'}
            </Button>
            <form
                id="audit-filters"
                onSubmit={(e) => { e.preventDefault(); setApplied(filters); setShowFilters(false); }}
                className={cn('gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-[var(--shadow-card)] sm:grid-cols-2 lg:grid-cols-4 md:grid', showFilters ? 'grid' : 'hidden')}
                aria-label="Filters"
            >
                <div className="space-y-1.5"><Label htmlFor="f-from">From</Label><Input id="f-from" type="date" value={filters.from} onChange={set('from')} /></div>
                <div className="space-y-1.5"><Label htmlFor="f-to">To</Label><Input id="f-to" type="date" value={filters.to} onChange={set('to')} /></div>
                <div className="space-y-1.5">
                    <Label htmlFor="f-action">Action</Label>
                    <select id="f-action" className={selectClass} value={filters.action} onChange={set('action')}>
                        <option value="">Any</option>{ACTIONS.map((a) => <option key={a} value={a}>{label(a)}</option>)}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="f-entity">Record type</Label>
                    <select id="f-entity" className={selectClass} value={filters.entity} onChange={set('entity')}>
                        <option value="">Any</option>{ENTITIES.map((a) => <option key={a} value={a}>{label(a)}</option>)}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="f-outcome">Outcome</Label>
                    <select id="f-outcome" className={selectClass} value={filters.outcome} onChange={set('outcome')}>
                        <option value="">Any</option><option value="SUCCESS">Success</option><option value="DENIED">Denied</option><option value="FAILURE">Failure</option>
                    </select>
                </div>
                <div className="space-y-1.5"><Label htmlFor="f-actor">Staff member ID</Label><Input id="f-actor" inputMode="numeric" placeholder="e.g. 12" value={filters.actor} onChange={set('actor')} /></div>
                <div className="space-y-1.5"><Label htmlFor="f-patient">Patient ID</Label><Input id="f-patient" inputMode="numeric" placeholder="e.g. 34" value={filters.patient} onChange={set('patient')} /></div>
                <div className="flex items-end gap-2">
                    <Button type="submit" className="flex-1 gap-2"><Filter className="h-4 w-4" aria-hidden /> Apply</Button>
                    <Button
                        type="button" variant="ghost"
                        onClick={() => { const empty = { from: '', to: '', action: '', entity: '', outcome: '', patient: '', actor: '' }; setFilters(empty); setApplied(empty); }}
                    >
                        Clear
                    </Button>
                </div>
            </form>

            {state === 'loading' ? <LoadingState label="Loading the audit log…" /> : state === 'error' ? (
                <ErrorState title="Could not load the audit log" description="If the audit table has not been created yet, run 19_audit_log.sql." onRetry={() => load(applied)} />
            ) : rows.length === 0 ? (
                <EmptyState icon={ScrollText} title="No matching entries" description="Try widening the dates or clearing a filter." />
            ) : (
                <>
                    {/* Phones: one card per event. Larger screens: a table. */}
                    <ul className="space-y-2.5 md:hidden">
                        {rows.map((r) => (
                            <li key={r.id} className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-[var(--shadow-card)]">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="font-semibold capitalize text-neutral-900">{label(r.action)} {label(r.entity_type)}</p>
                                    <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', OUTCOME_STYLE[r.outcome])}>{label(r.outcome)}</span>
                                </div>
                                <p className="mt-1 text-sm text-neutral-700">{who(r)}{r.actor_role ? ` · ${label(r.actor_role)}` : ''}</p>
                                {r.patient_id && <p className="text-sm text-neutral-600">Patient: {r.patient_name ?? `#${r.patient_id}`}</p>}
                                <p className="mt-1 text-xs text-neutral-500">{formatDateTime(r.occurred_at)}{r.ip ? ` · ${r.ip}` : ''}</p>
                                {r.details && <p className="mt-1 break-words text-xs text-neutral-500">{detailsText(r.details)}</p>}
                            </li>
                        ))}
                    </ul>

                    <div tabIndex={0} role="region" aria-label="Audit log entries" className="hidden overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-[var(--shadow-card)] md:block">
                        <table className="w-full text-sm">
                            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                                <tr>
                                    <th className="px-3 py-2.5">When</th><th className="px-3 py-2.5">Who</th><th className="px-3 py-2.5">Action</th>
                                    <th className="px-3 py-2.5">Patient</th><th className="px-3 py-2.5">Outcome</th><th className="px-3 py-2.5">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {rows.map((r) => (
                                    <tr key={r.id} className="align-top">
                                        <td className="whitespace-nowrap px-3 py-2.5 text-neutral-700">{formatDateTime(r.occurred_at)}</td>
                                        <td className="px-3 py-2.5"><span className="font-medium text-neutral-900">{who(r)}</span><br /><span className="text-xs capitalize text-neutral-500">{label(r.actor_role)}{r.ip ? ` · ${r.ip}` : ''}</span></td>
                                        <td className="px-3 py-2.5 capitalize">{label(r.action)}<br /><span className="text-xs text-neutral-500">{label(r.entity_type)}{r.entity_id ? ` #${r.entity_id}` : ''}</span></td>
                                        <td className="px-3 py-2.5">{r.patient_id ? (r.patient_name ?? `#${r.patient_id}`) : '-'}</td>
                                        <td className="px-3 py-2.5"><span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', OUTCOME_STYLE[r.outcome])}>{label(r.outcome)}</span></td>
                                        <td className="max-w-xs break-words px-3 py-2.5 text-xs text-neutral-500">{detailsText(r.details)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {cursor && (
                        <div className="flex justify-center">
                            <Button variant="outline" onClick={() => load(applied, true, cursor)} disabled={loadingMore} className="h-11 min-w-40">
                                {loadingMore ? 'Loading…' : 'Load older entries'}
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
