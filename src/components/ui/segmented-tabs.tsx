'use client';

import { cn } from '@/lib/utils';

export interface SegmentItem { value: string; label: string; badge?: number }

/** Page-level tabs: a row of big buttons that scrolls sideways on a phone. The caller shows the matching content. */
export function SegmentedTabs({ items, value, onChange, label, className }: {
    items: SegmentItem[]; value: string; onChange: (value: string) => void; label: string; className?: string;
}) {
    return (
        <div role="tablist" aria-label={label} className={cn('-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0', className)}>
            {items.map((item) => {
                const active = item.value === value;
                return (
                    <button
                        key={item.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(item.value)}
                        className={cn(
                            'flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors',
                            active ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50',
                        )}
                    >
                        {item.label}
                        {item.badge !== undefined && item.badge > 0 && (
                            <span className="rounded-full bg-amber-100 px-1.5 text-xs font-bold text-amber-900">{item.badge}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
