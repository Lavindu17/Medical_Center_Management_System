import * as React from 'react';
import {
    Activity, AlertTriangle, Ban, CalendarOff, CheckCircle2, CircleDashed, Clock, PackageCheck, PackageX, PartyPopper, UserCheck, XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONES: Record<Tone, string> = {
    success: 'bg-success-soft text-success border-emerald-200',
    warning: 'bg-warning-soft text-warning border-amber-200',
    danger:  'bg-danger-soft text-danger border-red-200',
    info:    'bg-info-soft text-info border-sky-200',
    neutral: 'bg-neutral-100 text-neutral-600 border-neutral-200',
};

export type StatusKind = 'appointment' | 'bill' | 'prescription' | 'lab' | 'batch' | 'attendance' | 'leave';

interface Meta { label: string; tone: Tone; icon: React.ComponentType<{ className?: string }> }

/**
 * One place that knows what every status in the system looks like. Colour is never the only signal: each status
 * has a distinct icon and a plain-language label ("Waiting", not "PENDING").
 */
const REGISTRY: Record<StatusKind, Record<string, Meta>> = {
    appointment: {
        PENDING:    { label: 'Booked',          tone: 'info',    icon: Clock },
        CONFIRMED:  { label: 'Confirmed',       tone: 'info',    icon: CheckCircle2 },
        CHECKED_IN: { label: 'Checked in',      tone: 'warning', icon: UserCheck },
        ARRIVED:    { label: 'Arrived',         tone: 'warning', icon: UserCheck },
        ONGOING:    { label: 'In consultation', tone: 'warning', icon: Activity },
        COMPLETED:  { label: 'Completed',       tone: 'success', icon: CheckCircle2 },
        CANCELLED:  { label: 'Cancelled',       tone: 'danger',  icon: XCircle },
        ABSENT:     { label: 'Absent',          tone: 'danger',  icon: Ban },
        NO_SHOW:    { label: 'No show',         tone: 'danger',  icon: Ban },
    },
    bill: {
        PENDING: { label: 'Unpaid', tone: 'warning', icon: Clock },
        PAID:    { label: 'Paid',   tone: 'success', icon: CheckCircle2 },
    },
    prescription: {
        PENDING:             { label: 'Waiting',          tone: 'warning', icon: Clock },
        PARTIALLY_COMPLETED: { label: 'Partly dispensed', tone: 'info',    icon: PackageCheck },
        DISPENSED:           { label: 'Dispensed',        tone: 'success', icon: PackageCheck },
        COMPLETED:           { label: 'Completed',        tone: 'success', icon: CheckCircle2 },
        REJECTED:            { label: 'Not supplied',     tone: 'danger',  icon: PackageX },
        CANCELLED:           { label: 'Cancelled',        tone: 'danger',  icon: XCircle },
    },
    lab: {
        PENDING:   { label: 'Awaiting result', tone: 'warning', icon: Clock },
        COMPLETED: { label: 'Result ready',    tone: 'success', icon: CheckCircle2 },
    },
    attendance: {
        PRESENT:    { label: 'Present',          tone: 'success', icon: CheckCircle2 },
        LATE:       { label: 'Late',             tone: 'warning', icon: Clock },
        ABSENT:     { label: 'Absent',           tone: 'danger',  icon: XCircle },
        ON_LEAVE:   { label: 'On leave',         tone: 'info',    icon: CalendarOff },
        HOLIDAY:    { label: 'Holiday',          tone: 'info',    icon: PartyPopper },
        DAY_OFF:    { label: 'Day off',          tone: 'neutral', icon: CircleDashed },
        INCOMPLETE: { label: 'Missing clock-out', tone: 'warning', icon: AlertTriangle },
        SCHEDULED:  { label: 'Scheduled',        tone: 'neutral', icon: Clock },
    },
    leave: {
        PENDING:   { label: 'Waiting for HR', tone: 'warning', icon: Clock },
        APPROVED:  { label: 'Approved',       tone: 'success', icon: CheckCircle2 },
        REJECTED:  { label: 'Declined',       tone: 'danger',  icon: XCircle },
        CANCELLED: { label: 'Cancelled',      tone: 'neutral', icon: Ban },
    },
    batch: {
        ACTIVE:   { label: 'In stock', tone: 'success', icon: PackageCheck },
        DEPLETED: { label: 'Used up',  tone: 'neutral', icon: CircleDashed },
        EXPIRED:  { label: 'Expired',  tone: 'danger',  icon: AlertTriangle },
    },
};

const FALLBACK: Meta = { label: '', tone: 'neutral', icon: CircleDashed };

/** Readable fallback for a status this registry does not know: "SOME_STATUS" -> "Some status" */
function humanise(status: string) {
    const text = status.replace(/_/g, ' ').toLowerCase();
    return text.charAt(0).toUpperCase() + text.slice(1);
}

export function statusMeta(status: string, kind: StatusKind): Meta {
    const found = REGISTRY[kind][status];
    return found ?? { ...FALLBACK, label: humanise(status) };
}

export function StatusBadge({
    status, kind = 'appointment', className, size = 'md',
}: { status: string; kind?: StatusKind; className?: string; size?: 'sm' | 'md' }) {
    const { label, tone, icon: Icon } = statusMeta(status, kind);
    return (
        <span
            className={cn(
                'inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold',
                size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
                TONES[tone],
                className,
            )}
        >
            <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden />
            {label}
        </span>
    );
}
