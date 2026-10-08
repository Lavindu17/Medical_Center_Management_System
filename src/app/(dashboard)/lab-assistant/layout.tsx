'use client';

import { AppShell } from '@/components/app-shell';
import { LayoutDashboard, TestTube, Settings } from 'lucide-react';

const navItems = [
    { icon: LayoutDashboard, label: 'Pending Requests', href: '/lab-assistant' },
    { icon: TestTube,        label: 'Manage Tests',     href: '/lab-assistant/tests' },
    { icon: Settings,        label: 'Settings',         href: '/lab-assistant/settings' },
];

export default function LabAssistantLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppShell navItems={navItems} roleName="Lab Assistant" roleHref="/lab-assistant">
            {children}
        </AppShell>
    );
}
