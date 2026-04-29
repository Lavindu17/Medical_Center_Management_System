'use client';

import { AppSidebar } from '@/components/app-sidebar';
import { LayoutDashboard, Package, FileText, Settings } from 'lucide-react';

const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard',     href: '/pharmacist' },
    { icon: Package,         label: 'Inventory',     href: '/pharmacist/inventory' },
    { icon: FileText,        label: 'Prescriptions', href: '/pharmacist/prescriptions' },
    { icon: Settings,        label: 'Settings',      href: '/pharmacist/settings' },
];

export default function PharmacistLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-neutral-50 flex font-sans">
            <AppSidebar navItems={navItems} roleName="Pharmacy" roleHref="/pharmacist" />
            <main className="flex-1 md:ml-64 min-h-screen">
                <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto pt-16 md:pt-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
