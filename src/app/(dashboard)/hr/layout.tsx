'use client';

import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/AuthContext';
import { LayoutDashboard, Users, CalendarDays, ClipboardCheck, CalendarOff, SlidersHorizontal, Clock, UserCog, ShieldCheck } from 'lucide-react';

const baseItems = [
    { icon: LayoutDashboard,   label: 'Overview',   href: '/hr' },
    { icon: Users,             label: 'Employees',  href: '/hr/employees' },
    { icon: CalendarDays,      label: 'Roster',     href: '/hr/roster' },
    { icon: ClipboardCheck,    label: 'Attendance', href: '/hr/attendance' },
    { icon: CalendarOff,       label: 'Leave',      href: '/hr/leave' },
    { icon: SlidersHorizontal, label: 'Settings',   href: '/hr/settings' },
    { icon: Clock,             label: 'My Work',    href: '/hr/work' },
    { icon: UserCog,           label: 'Account',    href: '/hr/account' },
];

export default function HrLayout({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    // Administrators use this portal too, so they need a way back to their own area
    const navItems = user?.role === 'ADMIN'
        ? [{ icon: ShieldCheck, label: 'Back to Admin', href: '/admin' }, ...baseItems]
        : baseItems;
    return (
        <AppShell navItems={navItems} roleName="HR" roleHref={user?.role === 'ADMIN' ? '/admin' : '/hr'}>
            {children}
        </AppShell>
    );
}
