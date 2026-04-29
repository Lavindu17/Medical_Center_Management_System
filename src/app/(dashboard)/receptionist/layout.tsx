'use client';

import { AppSidebar } from '@/components/app-sidebar';
import { LayoutDashboard, Calendar, Banknote, Settings, Users, UserPlus } from 'lucide-react';

const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard',         href: '/receptionist' },
    { icon: Calendar,        label: 'Appointments',      href: '/receptionist/appointments' },
    { icon: UserPlus,        label: 'Register Patient',  href: '/receptionist/register' },
    { icon: Users,           label: 'Patient Directory', href: '/receptionist/patients' },
    { icon: Banknote,        label: 'Billing',           href: '/receptionist/billing' },
    { icon: Settings,        label: 'Settings',          href: '/receptionist/settings' },
];

export default function ReceptionistLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-neutral-50 flex font-sans">
            <AppSidebar navItems={navItems} roleName="Reception" roleHref="/receptionist" />
            <main className="flex-1 md:ml-64 min-h-screen">
                <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto pt-16 md:pt-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
