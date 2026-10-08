import * as React from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    /** Buttons or links shown on the right (stack below the title on phones) */
    actions?: React.ReactNode;
    /** A "back" link above the title for detail pages */
    back?: { href: string; label: string };
    className?: string;
}

/** The title block every screen starts with, so pages feel like one product. */
export function PageHeader({ title, description, actions, back, className }: PageHeaderProps) {
    return (
        <header className={cn('flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between', className)}>
            <div className="min-w-0 space-y-1">
                {back && (
                    <Link
                        href={back.href}
                        className="-ml-1 mb-1 inline-flex items-center gap-1 rounded-md px-1 py-1 text-sm font-medium text-neutral-500 hover:text-emerald-700"
                    >
                        <ChevronLeft className="h-4 w-4" aria-hidden />
                        {back.label}
                    </Link>
                )}
                <h1 className="text-2xl font-bold tracking-tight text-neutral-900 md:text-3xl">{title}</h1>
                {description && <p className="max-w-2xl text-sm text-neutral-500 md:text-base">{description}</p>}
            </div>
            {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
    );
}
