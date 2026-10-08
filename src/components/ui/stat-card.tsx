import * as React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'brand' | 'info' | 'warning' | 'danger' | 'neutral';

const TONES: Record<Tone, { chip: string; value: string }> = {
    brand:   { chip: 'bg-emerald-50 text-emerald-700', value: 'text-neutral-900' },
    info:    { chip: 'bg-sky-50 text-sky-700',         value: 'text-neutral-900' },
    warning: { chip: 'bg-amber-50 text-amber-700',     value: 'text-neutral-900' },
    danger:  { chip: 'bg-red-50 text-red-700',         value: 'text-red-700' },
    neutral: { chip: 'bg-neutral-100 text-neutral-600', value: 'text-neutral-900' },
};

interface StatCardProps {
    label: string;
    value: React.ReactNode;
    /** Short context under the number: "3 more than yesterday", "Scheduled for today" */
    hint?: React.ReactNode;
    icon?: React.ComponentType<{ className?: string }>;
    tone?: Tone;
    /** Makes the whole card a link to the place where the number comes from */
    href?: string;
    /** Tighter version for a row of three on a phone: smaller padding, no icon or hint below the sm breakpoint */
    compact?: boolean;
    className?: string;
}

/** A single headline number. Compact, with the number as the loudest thing on the card. */
export function StatCard({ label, value, hint, icon: Icon, tone = 'brand', href, compact, className }: StatCardProps) {
    const t = TONES[tone];
    const body = (
        <>
            <div className="flex items-start justify-between gap-3">
                <p className={cn('font-semibold uppercase tracking-wide text-neutral-500', compact ? 'text-[11px] sm:text-xs' : 'text-xs')}>{label}</p>
                {Icon && (
                    <span className={cn('h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg', compact ? 'hidden sm:flex' : 'flex', t.chip)} aria-hidden>
                        <Icon className="h-4 w-4" />
                    </span>
                )}
            </div>
            <p className={cn('font-bold leading-none tabular tracking-tight', compact ? 'mt-2 text-2xl sm:mt-3 sm:text-3xl' : 'mt-3 text-3xl', t.value)}>{value}</p>
            {hint && <p className={cn('mt-2 text-xs text-neutral-500', compact && 'hidden sm:block')}>{hint}</p>}
            {href && (
                <ArrowUpRight
                    className="absolute bottom-3 right-3 hidden h-4 w-4 text-neutral-300 transition-colors group-hover:text-emerald-600 sm:block"
                    aria-hidden
                />
            )}
        </>
    );

    const base = cn('relative rounded-xl border border-neutral-200 bg-white shadow-[var(--shadow-card)]', compact ? 'p-3 sm:p-4' : 'p-4');
    return href ? (
        <Link href={href} className={cn(base, 'group block transition-shadow hover:shadow-[var(--shadow-raised)]', className)}>
            {body}
        </Link>
    ) : (
        <div className={cn(base, className)}>{body}</div>
    );
}
