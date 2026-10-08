'use client';

import { AppShell, type BottomTab } from '@/components/app-shell';
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

// The four things people do most, within thumb reach on a phone. "More" opens everything else.
const bottomTabs: BottomTab[] = [
    { icon: LayoutDashboard, label: 'Home',      href: '/patient' },
    { icon: CalendarClock,   label: 'Visits',    href: '/patient/appointments' },
    { icon: CalendarCheck,   label: 'Book',      href: '/patient/book', primary: true },
    { icon: Pill,            label: 'Medicines', href: '/patient/prescriptions' },
];

export default function PatientLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppShell navItems={navItems} bottomTabs={bottomTabs} hideTabsOn={['/patient/book']} roleName="Patient Portal" roleHref="/patient">
            {children}
        </AppShell>
    );
}
