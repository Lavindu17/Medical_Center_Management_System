'use client';

import { AppSidebar } from '@/components/app-sidebar';
import { LayoutDashboard, Users, FileText, Settings, HeartPulse, Banknote } from 'lucide-react';

const navItems = [
    { icon: LayoutDashboard, label: 'Overview',        href: '/admin' },
    { icon: Banknote,        label: 'Revenue',         href: '/admin/revenue' },
    { icon: Users,           label: 'User Management', href: '/admin/users' },
    { icon: HeartPulse,      label: 'Doctor Fees',     href: '/admin/doctors' },
    { icon: FileText,        label: 'System Logs',     href: '/admin/logs' },
    { icon: Settings,        label: 'Settings',        href: '/admin/settings' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-neutral-50 flex font-sans">
            <AppSidebar navItems={navItems} roleName="Admin" roleHref="/admin" />
            <main className="flex-1 md:ml-64 min-h-screen">
                <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto pt-16 md:pt-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
