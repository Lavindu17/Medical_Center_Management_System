'use client';

import { AppShell } from '@/components/app-shell';
import { LayoutDashboard, TestTube, UserCog, Clock } from 'lucide-react';

const navItems = [
    { icon: LayoutDashboard, label: 'Lab Requests'    , href: '/lab-assistant' },
    { icon: TestTube,        label: 'Manage Tests',     href: '/lab-assistant/tests' },
    { icon: Clock, label: 'My Work', href: '/lab-assistant/work' },
    { icon: UserCog,        label: 'Account',  href: '/lab-assistant/account' },
];

export default function LabAssistantLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppShell navItems={navItems} roleName="Lab Assistant" roleHref="/lab-assistant">
            {children}
        </AppShell>
    );
}
