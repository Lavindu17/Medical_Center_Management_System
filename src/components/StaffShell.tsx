'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import {
    AlertTriangle, Banknote, Calendar, CalendarCheck, CalendarDays, CalendarOff, ClipboardCheck, ClipboardList, Clock, FileText, FlaskConical,
    HeartPulse, LayoutDashboard, Package, ShieldCheck, SlidersHorizontal, User, UserCog, UserPlus, Users, type LucideIcon,
} from 'lucide-react';
import { AppShell, type NavItem } from '@/components/app-shell';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state-views';
import { useApi } from '@/hooks/useApi';
import { homeFor, mayOpen, screensFor } from '@/lib/access/screens';
import type { GrantMap } from '@/lib/access/defaults';

const ICONS: Record<string, LucideIcon> = {
    AlertTriangle, Banknote, Calendar, CalendarCheck, CalendarDays, CalendarOff, ClipboardCheck, ClipboardList, Clock, FileText, FlaskConical,
    HeartPulse, LayoutDashboard, Package, ShieldCheck, SlidersHorizontal, User, UserCog, UserPlus, Users,
};

interface Access { role: string; grants: GrantMap }

/**
 * The one frame for every member of staff. The menu is built from what the person's permissions open, and a page they have
 * no permission for shows a plain "no access" message instead of loading (the data routes refuse them as well).
 */
export function StaffShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { data, loading, error, reload } = useApi<Access>('/api/access/me', { refreshMs: 60_000 });

    const navItems: NavItem[] = useMemo(() => {
        if (!data) return [];
        return screensFor(data.grants).map((s) => ({ icon: ICONS[s.icon] ?? LayoutDashboard, label: s.label, href: s.href, section: s.section }));
    }, [data]);

    const home = (data && homeFor(data.role, data.grants)) || '/staff';

    let content: React.ReactNode = children;
    if (loading && !data) content = <LoadingState label="Loading your menu…" />;
    else if (error && !data) content = <ErrorState title="Could not load your access" description={error} onRetry={reload} />;
    else if (data && !mayOpen(data.grants, pathname)) {
        content = (
            <EmptyState
                icon={ShieldCheck}
                title="You do not have access to this page"
                description="Your account is not set up for this screen. Ask your administrator if you need it."
                action={{ label: 'Go to your home page', href: home }}
            />
        );
    }

    return (
        <AppShell navItems={navItems} roleName="Staff" roleHref="/staff">
            {content}
        </AppShell>
    );
}

/** A small link used by pages that want to send people back to where they belong. */
export function HomeLink({ className }: { className?: string }) {
    return <Link href="/staff" className={className}>Home</Link>;
}
