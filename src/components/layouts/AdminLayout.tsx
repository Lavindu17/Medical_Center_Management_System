'use client';

import { AppShell } from '@/components/app-shell';
import { LayoutDashboard, Users, FileText, UserCog, HeartPulse, Banknote } from 'lucide-react';

const navItems = [
    { icon: LayoutDashboard, label: 'Overview',        href: '/admin' },
    { icon: Banknote,        label: 'Revenue',         href: '/admin/revenue' },
    { icon: Users,           label: 'User Management', href: '/admin/users' },
    { icon: HeartPulse,      label: 'Doctor Fees',     href: '/admin/doctors' },
    { icon: FileText,        label: 'System Logs',     href: '/admin/logs' },
    { icon: UserCog,        label: 'Account',         href: '/admin/account' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppShell navItems={navItems} roleName="Admin" roleHref="/admin">
            {children}
        </AppShell>
    );
}
