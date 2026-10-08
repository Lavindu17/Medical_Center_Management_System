'use client';

import { AppShell } from '@/components/app-shell';
import { LayoutDashboard, Package, FileText, AlertTriangle, UserCog } from 'lucide-react';

const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard',     href: '/pharmacist' },
    { icon: Package,         label: 'Inventory',     href: '/pharmacist/inventory' },
    { icon: FileText,        label: 'Prescriptions', href: '/pharmacist/prescriptions' },
    { icon: AlertTriangle, label: 'Alerts',       href: '/pharmacist/alerts' },
    { icon: UserCog,        label: 'Account',  href: '/pharmacist/account' },
];

export default function PharmacistLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppShell navItems={navItems} roleName="Pharmacy" roleHref="/pharmacist">
            {children}
        </AppShell>
    );
}
