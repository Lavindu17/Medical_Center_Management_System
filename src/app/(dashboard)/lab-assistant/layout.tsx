'use client';

import { AppSidebar } from '@/components/app-sidebar';
import { LayoutDashboard, TestTube, Settings } from 'lucide-react';

const navItems = [
    { icon: LayoutDashboard, label: 'Pending Requests', href: '/lab-assistant' },
    { icon: TestTube,        label: 'Manage Tests',     href: '/lab-assistant/tests' },
    { icon: Settings,        label: 'Settings',         href: '/lab-assistant/settings' },
];

export default function LabAssistantLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-neutral-50 flex font-sans">
            <AppSidebar navItems={navItems} roleName="Lab Assistant" roleHref="/lab-assistant" />
            <main className="flex-1 md:ml-64 min-h-screen">
                <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto pt-16 md:pt-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
