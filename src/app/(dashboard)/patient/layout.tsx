'use client';

import { AppShell } from '@/components/app-shell';
import {
    LayoutDashboard, Pill, FileText, CreditCard,
    CalendarCheck, CalendarClock, User, UserCog, Users
} from 'lucide-react';

const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard',        href: '/patient' },
    { icon: CalendarClock,   label: 'My Appointments',  href: '/patient/appointments' },
    { icon: CalendarCheck,   label: 'Book Appointment', href: '/patient/book' },
    { icon: Pill,            label: 'Prescriptions',    href: '/patient/prescriptions' },
    { icon: FileText,        label: 'Lab Reports',      href: '/patient/labs' },
    { icon: CreditCard,      label: 'Billing',          href: '/patient/billing' },
    { icon: Users,           label: 'Family',           href: '/patient/family' },
    { icon: User,            label: 'Health Profile',   href: '/patient/profile' },
    { icon: UserCog,        label: 'Account',          href: '/patient/account' },
];

export default function PatientLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppShell navItems={navItems} roleName="Patient Portal" roleHref="/patient">
            {children}
        </AppShell>
    );
}
