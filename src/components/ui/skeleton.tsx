import { cn } from '@/lib/utils';

interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
    return (
        <div
            className={cn(
                'animate-pulse rounded-md bg-neutral-200/80',
                className
            )}
        />
    );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
    return (
        <div className="border border-neutral-200 rounded-xl p-4 space-y-3 bg-white">
            <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                </div>
            </div>
            {Array.from({ length: lines - 1 }).map((_, i) => (
                <Skeleton key={i} className={`h-3 ${i === lines - 2 ? 'w-3/4' : 'w-full'}`} />
            ))}
        </div>
    );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
    return (
        <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white">
            {/* Header */}
            <div className="flex gap-4 px-4 py-3 border-b border-neutral-100 bg-neutral-50">
                {Array.from({ length: cols }).map((_, i) => (
                    <Skeleton key={i} className="h-3 flex-1" />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, r) => (
                <div key={r} className="flex gap-4 px-4 py-3.5 border-b border-neutral-50 last:border-0">
                    {Array.from({ length: cols }).map((_, c) => (
                        <Skeleton key={c} className={`h-3 flex-1 ${c === 0 ? 'w-1/4' : ''}`} />
                    ))}
                </div>
            ))}
        </div>
    );
}

export function SkeletonKpiRow({ count = 4 }: { count?: number }) {
    return (
        <div className={`grid grid-cols-2 lg:grid-cols-${count} gap-3`}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="border border-neutral-200 rounded-xl p-4 space-y-3 bg-white">
                    <div className="flex justify-between items-start">
                        <Skeleton className="h-2.5 w-20" />
                        <Skeleton className="h-7 w-7 rounded-lg" />
                    </div>
                    <Skeleton className="h-7 w-28" />
                    <Skeleton className="h-2.5 w-16" />
                </div>
            ))}
        </div>
    );
}
