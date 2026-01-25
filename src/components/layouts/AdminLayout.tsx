'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    Users,
    FileText,
    Settings,
    LogOut,
    Menu,
    HeartPulse
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';

const sidebarItems = [
    { icon: LayoutDashboard, label: 'Overview', href: '/admin' },
    { icon: Users, label: 'User Management', href: '/admin/users' },
    { icon: FileText, label: 'System Logs', href: '/admin/logs' },
    { icon: Settings, label: 'Settings', href: '/admin/settings' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    const handleLogout = async () => {
        // In a real app, call logout API to clear cookie
        // await fetch('/api/auth/logout', { method: 'POST' });
        document.cookie = 'token=; Max-Age=0; path=/;'; // Simple client-side clear for now
        router.push('/login');
    };

    const SidebarContent = () => (
        <div className="flex flex-col h-full bg-neutral-900 text-white">
            <div className="flex items-center gap-2 p-6 border-b border-neutral-800">
                <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                    <HeartPulse className="h-5 w-5" />
                </div>
                <span className="font-bold text-lg">Sethro Admin</span>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                {sidebarItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                ? 'bg-blue-600 text-white'
                                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                                }`}
                            onClick={() => setIsMobileOpen(false)}
                        >
                            <item.icon className="h-5 w-5" />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-neutral-800">
                <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    onClick={handleLogout}
                >
                    <LogOut className="h-5 w-5" />
                    <span>Logout</span>
                </Button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex">
            {/* Desktop Sidebar */}
            <aside className="hidden md:block w-64 shrink-0">
                <div className="h-full fixed w-64">
                    <SidebarContent />
                </div>
            </aside>

            {/* Mobile Sidebar */}
            <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                <SheetContent side="left" className="p-0 w-64 border-r-0">
                    <SidebarContent />
                </SheetContent>
            </Sheet>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-h-screen">
                <header className="h-16 px-6 bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between md:justify-end">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden"
                        onClick={() => setIsMobileOpen(true)}
                    >
                        <Menu className="h-6 w-6" />
                    </Button>

                    <div className="flex items-center gap-4">
                        <div className="text-sm text-neutral-500">
                            Logged in as <span className="font-semibold text-neutral-900 dark:text-white">Admin</span>
                        </div>
                    </div>
                </header>

                <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
                    {children}
                </div>
            </main>
        </div>
    );
}
