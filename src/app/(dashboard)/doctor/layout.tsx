'use client';

import { AppSidebar } from '@/components/app-sidebar';
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
        <div className="min-h-screen bg-neutral-50 flex font-sans">
            <AppSidebar navItems={navItems} roleName="Doctor Portal" roleHref="/doctor" />
            <main className="flex-1 md:ml-64 min-h-screen">
                <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto pt-16 md:pt-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
