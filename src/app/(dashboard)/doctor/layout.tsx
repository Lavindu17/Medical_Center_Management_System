'use client';

import { AppShell } from '@/components/app-shell';
import { LayoutDashboard, Calendar, Users, Banknote, User, UserCog, Clock } from 'lucide-react';

const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard',       href: '/doctor' },
    { icon: Calendar,        label: 'Appointments',    href: '/doctor/appointments' },
    { icon: Users,           label: 'Patients',        href: '/doctor/patients' },
    { icon: Banknote,        label: 'Earnings',        href: '/doctor/earnings' },
    { icon: User,            label: 'Practice Profile', href: '/doctor/profile' },
    { icon: Clock, label: 'My Work', href: '/doctor/work' },
    { icon: UserCog,        label: 'Account',          href: '/doctor/account' },
];

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppShell navItems={navItems} roleName="Doctor Portal" roleHref="/doctor">
            {children}
        </AppShell>
    );
}
