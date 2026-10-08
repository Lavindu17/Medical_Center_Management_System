'use client';

import { AppShell } from '@/components/app-shell';
import { LayoutDashboard, Package, FileText, Settings } from 'lucide-react';

const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard',     href: '/pharmacist' },
    { icon: Package,         label: 'Inventory',     href: '/pharmacist/inventory' },
    { icon: FileText,        label: 'Prescriptions', href: '/pharmacist/prescriptions' },
    { icon: Settings,        label: 'Settings',      href: '/pharmacist/settings' },
];

export default function PharmacistLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppShell navItems={navItems} roleName="Pharmacy" roleHref="/pharmacist">
            {children}
        </AppShell>
    );
}
