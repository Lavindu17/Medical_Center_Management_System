'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/ui/state-views';
import { formatDateTime } from '@/lib/dates';

interface AccessRow {
    id: number;
    occurred_at: string;
    actor_name: string | null;
    actor_role: string | null;
    on_behalf_of_id: number | null;
    action: string;
    entity_type: string | null;
}

const ROLE: Record<string, string> = {
    DOCTOR: 'Doctor', PHARMACIST: 'Pharmacist', LAB_ASSISTANT: 'Lab', RECEPTIONIST: 'Reception', ADMIN: 'Administrator', PATIENT: 'Family member',
};

/** Plain-language description of what happened to the patient's record. */
function describe(action: string, entity: string | null): string {
    const key = `${action}:${entity}`;
    const known: Record<string, string> = {
        'VIEW:PATIENT_CHART': 'viewed your medical record',
        'VIEW:PATIENT_PROFILE': 'viewed your profile',
        'VIEW:APPOINTMENT': 'viewed an appointment',
        'VIEW:CONSULTATION': 'opened a consultation',
        'VIEW:PRESCRIPTION': 'viewed a prescription',
        'DOWNLOAD:LAB_REPORT': 'downloaded a lab report',
        'CREATE:LAB_REPORT': 'uploaded a lab result',
        'CREATE:APPOINTMENT': 'booked an appointment',
        'STATUS_CHANGE:APPOINTMENT': 'changed an appointment',
        'UPDATE:CONSULTATION': 'updated a consultation',
        'STATUS_CHANGE:CONSULTATION': 'completed a consultation',
        'DISPENSE:PRESCRIPTION': 'dispensed your medicine',
        'REJECT:PRESCRIPTION': 'marked a medicine as not supplied',
        'UPDATE:BILL': 'recorded a payment',
        'UPDATE:PATIENT_PROFILE': 'updated your profile',
        'UPDATE:USER': 'updated your account details',
        'CREATE:USER': 'created your account',
        'CREATE:FAMILY_LINK': 'created a family link',
        'UPDATE:FAMILY_LINK': 'answered a family link request',
    };
    return known[key] ?? `${action.toLowerCase().replace(/_/g, ' ')} (${(entity ?? 'record').toLowerCase().replace(/_/g, ' ')})`;
}

/** Repeated identical views by one person within half an hour read as one line ("... 5 times"), so the list stays readable. */
function group(rows: AccessRow[]): (AccessRow & { times: number })[] {
    const out: (AccessRow & { times: number })[] = [];
    for (const r of rows) {
        const last = out[out.length - 1];
        const close = last && Math.abs(new Date(last.occurred_at).getTime() - new Date(r.occurred_at).getTime()) < 30 * 60 * 1000;
        if (last && close && last.actor_name === r.actor_name && last.action === r.action && last.entity_type === r.entity_type && last.on_behalf_of_id === r.on_behalf_of_id) last.times++;
        else out.push({ ...r, times: 1 });
    }
    return out;
}

/** "Who has looked at my record?" Patients are entitled to see it, and it keeps staff honest. */
export function AccessHistoryCard() {
    const [rows, setRows] = useState<AccessRow[]>([]);
    const [cursor, setCursor] = useState<number | null>(null);
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [more, setMore] = useState(false);

    const load = useCallback(async (before?: number | null) => {
        if (before) setMore(true); else setState('loading');
        try {
            const res = await fetch(`/api/patient/access-log${before ? `?cursor=${before}` : ''}`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            setRows((prev) => (before ? [...prev, ...data.rows] : data.rows));
            setCursor(data.nextCursor);
            setState('ready');
        } catch {
            setState('error');
        } finally {
            setMore(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    return (
        <Card className="shadow-[var(--shadow-card)]">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><Eye className="h-5 w-5 text-emerald-700" aria-hidden /> Who has accessed your record</CardTitle>
                <CardDescription>
                    Everyone at the clinic who views or changes your medical information is recorded here. If something looks wrong, tell the clinic.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {state === 'loading' ? <LoadingState label="Loading…" /> : state === 'error' ? (
                    <ErrorState title="Could not load your access history" onRetry={() => load()} className="border-0" />
                ) : rows.length === 0 ? (
                    <p className="py-6 text-center text-sm text-neutral-600">No one has accessed your record yet.</p>
                ) : (
                    <>
                        <ul className="divide-y divide-neutral-100">
                            {group(rows).map((r) => (
                                <li key={r.id} className="py-3">
                                    <p className="text-sm text-neutral-900">
                                        <span className="font-semibold">{r.actor_name ?? 'Clinic staff'}</span>{' '}
                                        <span className="text-neutral-600">({r.on_behalf_of_id ? 'family member acting for you' : (ROLE[r.actor_role ?? ''] ?? 'Staff')})</span>{' '}
                                        {describe(r.action, r.entity_type)}{r.times > 1 ? ` (${r.times} times)` : ''}
                                    </p>
                                    <p className="text-xs text-neutral-500">{formatDateTime(r.occurred_at)}</p>
                                </li>
                            ))}
                        </ul>
                        {cursor && (
                            <Button variant="outline" className="mt-3 h-11 w-full sm:w-auto" onClick={() => load(cursor)} disabled={more}>
                                {more ? 'Loading…' : 'Show older'}
                            </Button>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
