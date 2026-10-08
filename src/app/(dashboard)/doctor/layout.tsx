'use client';

import { AppShell } from '@/components/app-shell';
import { LayoutDashboard, Calendar, Users, Banknote, User } from 'lucide-react';

const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard',       href: '/doctor' },
    { icon: Calendar,        label: 'Appointments',    href: '/doctor/appointments' },
    { icon: Users,           label: 'Patients',        href: '/doctor/patients' },
    { icon: Banknote,        label: 'Earnings',        href: '/doctor/earnings' },
    { icon: User,            label: 'Profile & Schedule', href: '/doctor/profile' },
];

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppShell navItems={navItems} roleName="Doctor Portal" roleHref="/doctor">
            {children}
        </AppShell>
    );
}
