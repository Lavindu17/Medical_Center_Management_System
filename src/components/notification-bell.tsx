'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useIsClient } from '@/hooks/useIsClient';

interface Item {
    id: number;
    title: string;
    body: string;
    link: string | null;
    isRead: boolean;
    createdAt: string;
}

const POLL_MS = 30_000;

/**
 * In-app notifications for the signed-in user. Nothing here is emailed or texted.
 *
 * The popover is only created in the browser: Radix generates element ids that differ between the server render and
 * hydration, which logged a hydration mismatch on every page. The placeholder has the same size, so nothing shifts.
 */
export function NotificationBell({ onNavigate }: { onNavigate?: () => void }) {
    const isClient = useIsClient();
    if (!isClient) {
        return (
            <button type="button" disabled aria-label="Notifications" className="ml-auto h-11 w-11 rounded-lg flex items-center justify-center text-neutral-500 md:h-9 md:w-9">
                <Bell className="h-4 w-4" />
            </button>
        );
    }
    return <NotificationBellInner onNavigate={onNavigate} />;
}

function NotificationBellInner({ onNavigate }: { onNavigate?: () => void }) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<Item[]>([]);
    const [unread, setUnread] = useState(0);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);

    const loadCount = useCallback(async () => {
        try {
            const res = await fetch('/api/notifications?countOnly=1', { cache: 'no-store' });
            if (res.ok) setUnread((await res.json()).unreadCount);
        } catch { /* offline: keep the last known count */ }
    }, []);

    const loadList = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/notifications?limit=20', { cache: 'no-store' });
            if (!res.ok) throw new Error('bad response');
            const data = await res.json();
            setItems(data.notifications);
            setUnread(data.unreadCount);
            setFailed(false);
        } catch {
            setFailed(true);
        } finally {
            setLoading(false);
        }
    }, []);

    // Keep the badge fresh while the tab is visible
    useEffect(() => {
        const tick = () => { if (document.visibilityState === 'visible') loadCount(); };
        const first = setTimeout(tick, 0);
        const timer = setInterval(tick, POLL_MS);
        document.addEventListener('visibilitychange', tick);
        return () => { clearTimeout(first); clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
    }, [loadCount]);

    function handleOpenChange(next: boolean) {
        setOpen(next);
        if (next) loadList();
    }

    async function markRead(body: { ids: number[] } | { all: true }) {
        try {
            const res = await fetch('/api/notifications/read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) return;
            setUnread((await res.json()).unreadCount);
            setItems((prev) => prev.map((n) => ('all' in body || body.ids.includes(n.id) ? { ...n, isRead: true } : n)));
        } catch { /* the next refresh will correct the badge */ }
    }

    function openItem(n: Item) {
        if (!n.isRead) markRead({ ids: [n.id] });
        setOpen(false);
        onNavigate?.();
    }

    const row = (n: Item) => {
        const content = (
            <>
                <span className={cn('mt-1.5 h-2 w-2 rounded-full flex-shrink-0', n.isRead ? 'bg-transparent' : 'bg-emerald-500')} aria-hidden />
                <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm truncate', n.isRead ? 'text-neutral-700' : 'font-semibold text-neutral-900')}>{n.title}</span>
                    <span className="block text-xs text-neutral-500 break-words">{n.body}</span>
                    <span className="block text-[11px] text-neutral-400 mt-0.5">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </span>
                </span>
            </>
        );
        const cls = 'flex gap-2.5 px-4 py-3 text-left w-full hover:bg-neutral-50 transition-colors';
        return n.link ? (
            <Link key={n.id} href={n.link} onClick={() => openItem(n)} className={cls}>{content}</Link>
        ) : (
            <button key={n.id} type="button" onClick={() => openItem(n)} className={cls}>{content}</button>
        );
    };

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="relative ml-auto h-11 w-11 md:h-9 md:w-9 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                    aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
                >
                    <Bell className="h-4 w-4" />
                    {unread > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-emerald-600 text-white text-[10px] font-semibold flex items-center justify-center">
                            {unread > 99 ? '99+' : unread}
                        </span>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" collisionPadding={12} className="w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden p-0">
                <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
                    <span className="text-sm font-semibold text-neutral-900">Notifications</span>
                    <button
                        type="button"
                        disabled={unread === 0}
                        onClick={() => markRead({ all: true })}
                        className="flex min-h-9 items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800 disabled:cursor-default disabled:text-neutral-400"
                    >
                        <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                    </button>
                </div>
                <div className="max-h-96 overflow-y-auto divide-y divide-neutral-100">
                    {loading && items.length === 0 && <p className="px-4 py-6 text-center text-sm text-neutral-400">Loading...</p>}
                    {failed && <p className="px-4 py-6 text-center text-sm text-red-500">Could not load notifications.</p>}
                    {!loading && !failed && items.length === 0 && (
                        <p className="px-4 py-8 text-center text-sm text-neutral-400">You&apos;re all caught up.</p>
                    )}
                    {items.map(row)}
                </div>
            </PopoverContent>
        </Popover>
    );
}
