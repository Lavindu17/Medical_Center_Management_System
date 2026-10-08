import * as React from 'react';
import Link from 'next/link';
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Action {
    label: string;
    href?: string;
    onClick?: () => void;
}

function ActionButton({ action, variant }: { action: Action; variant?: 'default' | 'outline' }) {
    return action.href ? (
        <Button asChild variant={variant}><Link href={action.href}>{action.label}</Link></Button>
    ) : (
        <Button variant={variant} onClick={action.onClick}>{action.label}</Button>
    );
}

/** "Nothing here yet" - always says what the space is for and what to do next, never a blank panel. */
export function EmptyState({
    icon: Icon = Inbox, title, description, action, className,
}: {
    icon?: React.ComponentType<{ className?: string }>;
    title: string;
    description?: string;
    action?: Action;
    className?: string;
}) {
    return (
        <div className={cn('flex flex-col items-center rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center', className)}>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700" aria-hidden>
                <Icon className="h-6 w-6" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-neutral-900">{title}</h3>
            {description && <p className="mt-1 max-w-sm text-sm text-neutral-500">{description}</p>}
            {action && <div className="mt-5"><ActionButton action={action} /></div>}
        </div>
    );
}

/** Something failed to load: say so near the problem and give a way to recover. */
export function ErrorState({
    title = "We couldn't load this", description = 'Check your connection and try again.', onRetry, className,
}: {
    title?: string;
    description?: string;
    onRetry?: () => void;
    className?: string;
}) {
    return (
        <div role="alert" className={cn('flex flex-col items-center rounded-xl border border-red-200 bg-red-50/60 px-6 py-10 text-center', className)}>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700" aria-hidden>
                <AlertCircle className="h-6 w-6" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-red-900">{title}</h3>
            <p className="mt-1 max-w-sm text-sm text-red-800">{description}</p>
            {onRetry && (
                <Button variant="outline" className="mt-5 gap-2 border-red-200 bg-white" onClick={onRetry}>
                    <RefreshCw className="h-4 w-4" aria-hidden /> Try again
                </Button>
            )}
        </div>
    );
}
