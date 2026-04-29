'use client';

import { AppSidebar } from '@/components/app-sidebar';
import {
    LayoutDashboard, Pill, FileText, CreditCard,
    CalendarCheck, CalendarClock, User, Users
} from 'lucide-react';

const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard',        href: '/patient' },
    { icon: CalendarClock,   label: 'My Appointments',  href: '/patient/appointments' },
    { icon: CalendarCheck,   label: 'Book Appointment', href: '/patient/book' },
    { icon: Pill,            label: 'Prescriptions',    href: '/patient/prescriptions' },
    { icon: FileText,        label: 'Lab Reports',      href: '/patient/labs' },
    { icon: CreditCard,      label: 'Billing',          href: '/patient/billing' },
    { icon: Users,           label: 'Family',           href: '/patient/family' },
    { icon: User,            label: 'Edit Profile',     href: '/patient/profile' },
];

export default function PatientLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-neutral-50 flex font-sans">
            <AppSidebar navItems={navItems} roleName="Patient Portal" roleHref="/patient" />
            <main className="flex-1 md:ml-64 min-h-screen">
                <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto pt-16 md:pt-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
