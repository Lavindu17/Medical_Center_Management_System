'use client';

import { AppShell } from '@/components/app-shell';
import { LayoutDashboard, Users, CalendarDays, ClipboardCheck, CalendarOff, SlidersHorizontal, Clock, UserCog } from 'lucide-react';

const navItems = [
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
    return (
        <AppShell navItems={navItems} roleName="HR" roleHref="/hr">
            {children}
        </AppShell>
    );
}
