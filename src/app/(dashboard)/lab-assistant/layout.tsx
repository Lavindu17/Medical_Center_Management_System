'use client';

import { AppShell } from '@/components/app-shell';
import { LayoutDashboard, TestTube, UserCog } from 'lucide-react';

const navItems = [
    { icon: LayoutDashboard, label: 'Lab Requests'    , href: '/lab-assistant' },
    { icon: TestTube,        label: 'Manage Tests',     href: '/lab-assistant/tests' },
    { icon: UserCog,        label: 'Account',  href: '/lab-assistant/account' },
];

export default function LabAssistantLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppShell navItems={navItems} roleName="Lab Assistant" roleHref="/lab-assistant">
            {children}
        </AppShell>
    );
}
