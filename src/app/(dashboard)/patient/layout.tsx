'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
    LayoutDashboard,
    Pill,
    FileText,
    CreditCard,
    LogOut,
    Menu,
    CalendarCheck
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
// import { ScrollArea } from '@/components/ui/scroll-area';

export default function PatientLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    const sidebarItems = [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/patient' },
        { icon: CalendarCheck, label: 'Book Appointment', href: '/patient/book' },
        { icon: Pill, label: 'Prescriptions', href: '/patient/prescriptions' },
        { icon: FileText, label: 'Lab Reports', href: '/patient/labs' },
        { icon: CreditCard, label: 'Billing', href: '/patient/billing' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 flex font-sans">
            {/* Sidebar for Desktop */}
            <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 z-50 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800">
                <div className="h-16 flex items-center px-6 border-b border-neutral-200 dark:border-neutral-800">
                    <Link href="/patient" className="flex items-center gap-2 font-bold text-xl tracking-tight text-blue-600 dark:text-blue-400">
                        <span className="text-2xl">🏥</span> Sethro<span className="text-neutral-900 dark:text-white">Patient</span>
                    </Link>
                </div>
                <div className="flex-1 overflow-y-auto py-6 px-4">
                    <nav className="space-y-1">
                        {sidebarItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link key={item.href} href={item.href}>
                                    <Button
                                        variant={isActive ? 'secondary' : 'ghost'}
                                        className={`w-full justify-start gap-3 h-10 ${isActive ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 font-semibold' : 'text-neutral-600 dark:text-neutral-400'}`}
                                    >
                                        <item.icon className={`h-4 w-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                                        {item.label}
                                    </Button>
                                </Link>
                            );
                        })}
                    </nav>
                </div>
                <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
                    <Button variant="outline" className="w-full justify-start gap-3 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" asChild>
                        {/* Use standard anchor tag to force full reload/navigation for logout */}
                        <a href="/api/auth/logout">
                            <LogOut className="h-4 w-4" /> Sign Out
                        </a>
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="md:ml-64 flex-1 flex flex-col">
                {/* Mobile Header */}
                <header className="md:hidden h-16 flex items-center justify-between px-4 border-b bg-white dark:bg-neutral-900 sticky top-0 z-40">
                    <Link href="/patient" className="font-bold text-lg">Sethro Medical</Link>
                    <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-64 p-0">
                            <div className="h-16 flex items-center px-6 border-b">
                                <span className="font-bold text-xl">Menu</span>
                            </div>
                            <nav className="p-4 space-y-2">
                                {sidebarItems.map((item) => (
                                    <Button
                                        key={item.href}
                                        variant={pathname === item.href ? 'secondary' : 'ghost'}
                                        className="w-full justify-start gap-3"
                                        asChild
                                        onClick={() => setIsMobileOpen(false)}
                                    >
                                        <Link href={item.href}>
                                            <item.icon className="h-4 w-4" /> {item.label}
                                        </Link>
                                    </Button>
                                ))}
                            </nav>
                        </SheetContent>
                    </Sheet>
                </header>

                <div className="flex-1 p-0 md:p-0">
                    {children}
                </div>
            </main>
        </div>
    );
}
