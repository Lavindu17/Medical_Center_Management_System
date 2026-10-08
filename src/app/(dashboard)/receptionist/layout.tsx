'use client';

import { AppShell } from '@/components/app-shell';
import { LayoutDashboard, Calendar, Banknote, UserCog, Users, UserPlus } from 'lucide-react';

const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard',         href: '/receptionist' },
    { icon: Calendar,        label: 'Appointments',      href: '/receptionist/appointments' },
    { icon: UserPlus,        label: 'Register Patient',  href: '/receptionist/register' },
    { icon: Users,           label: 'Patient Directory', href: '/receptionist/patients' },
    { icon: Banknote,        label: 'Billing',           href: '/receptionist/billing' },
    { icon: UserCog,        label: 'Account',  href: '/receptionist/account' },
];

export default function ReceptionistLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppShell navItems={navItems} roleName="Reception" roleHref="/receptionist">
            {children}
        </AppShell>
    );
}
