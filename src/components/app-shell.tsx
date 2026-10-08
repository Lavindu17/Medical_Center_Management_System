'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LogOut, Menu, HeartPulse, LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { NotificationBell } from '@/components/notification-bell';
import { useAuth } from '@/context/AuthContext';
import { useIsClient } from '@/hooks/useIsClient';
import { initialOf } from '@/lib/names';
import { cn } from '@/lib/utils';

export interface NavItem {
    icon: LucideIcon;
    label: string;
    href: string;
}

interface AppShellProps {
    navItems: NavItem[];
    /** "Patient Portal", "Pharmacy"... shown under the brand name */
    roleName: string;
    roleHref: string;
    children: React.ReactNode;
}

/** A nav item is active on its own page and on pages beneath it (the dispense detail page keeps "Prescriptions" lit). */
function isActivePath(pathname: string, href: string) {
    if (pathname === href) return true;
    const isSection = href.split('/').length > 2;           // "/patient" is the dashboard, "/patient/labs" is a section
    return isSection && pathname.startsWith(href + '/');
}

function Brand({ roleName, roleHref }: { roleName: string; roleHref: string }) {
    return (
        <Link href={roleHref} className="flex min-w-0 items-center gap-3 rounded-lg">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                <HeartPulse className="h-5 w-5" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate font-heading text-[15px] font-bold tracking-tight text-neutral-900">Sethro Medical</span>
                <span className="truncate text-[11px] font-semibold uppercase tracking-widest text-emerald-700">{roleName}</span>
            </span>
        </Link>
    );
}

function SidebarNav({ navItems, onNavigate }: { navItems: NavItem[]; onNavigate?: () => void }) {
    const pathname = usePathname();
    return (
        <nav aria-label="Main" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {navItems.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                            'group relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150',
                            active
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                        )}
                    >
                        {active && (
                            <motion.span
                                layoutId="nav-accent"
                                className="absolute inset-y-2 left-0 w-1 rounded-full bg-emerald-600"
                                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                            />
                        )}
                        <item.icon
                            className={cn('h-[18px] w-[18px] flex-shrink-0 transition-colors', active ? 'text-emerald-700' : 'text-neutral-400 group-hover:text-neutral-600')}
                            aria-hidden
                        />
                        <span className="truncate">{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}

function AccountCard() {
    const { user } = useAuth();
    return (
        <div className="space-y-1 border-t border-neutral-100 p-3">
            {user && (
                <div className="flex items-center gap-3 rounded-lg px-2 py-2">
                    <span
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800"
                        aria-hidden
                    >
                        {initialOf(user.name)}
                    </span>
                    <span className="min-w-0 leading-tight">
                        <span className="block truncate text-sm font-semibold text-neutral-900">{user.name}</span>
                        <span className="block truncate text-xs text-neutral-500">{user.email}</span>
                    </span>
                </div>
            )}
            <a
                href="/api/auth/logout"
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-neutral-600 transition-colors hover:bg-red-50 hover:text-red-700"
            >
                <LogOut className="h-[18px] w-[18px] flex-shrink-0" aria-hidden />
                Sign out
            </a>
        </div>
    );
}

/**
 * The frame around every signed-in screen: a fixed sidebar on desktop, a sticky top bar with a menu drawer on phones,
 * and the page content in a landmark that the "Skip to main content" link jumps to.
 */
export function AppShell({ navItems, roleName, roleHref, children }: AppShellProps) {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const isClient = useIsClient();   // Radix generates different ids on server and client; create the drawer in the browser only

    return (
        <div className="flex min-h-screen bg-background">
            {/* Desktop sidebar */}
            <aside className="fixed inset-y-0 z-30 hidden w-64 flex-col border-r border-neutral-200 bg-white md:flex">
                <div className="flex h-16 items-center gap-2 border-b border-neutral-100 px-4">
                    <Brand roleName={roleName} roleHref={roleHref} />
                    <NotificationBell />
                </div>
                <SidebarNav navItems={navItems} />
                <AccountCard />
            </aside>

            <div className="flex min-h-screen min-w-0 flex-1 flex-col md:pl-64">
                {/* Phone top bar: menu, brand, notifications */}
                <header data-app-header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-neutral-200 bg-white/95 px-3 backdrop-blur md:hidden">
                    {isClient ? (
                        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                            <SheetTrigger asChild>
                                <button
                                    type="button"
                                    className="flex h-11 w-11 items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100"
                                    aria-label="Open menu"
                                >
                                    <Menu className="h-5 w-5" aria-hidden />
                                </button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-72 gap-0 border-0 p-0">
                                <SheetTitle className="sr-only">Navigation</SheetTitle>
                                <SheetDescription className="sr-only">Pages you can open</SheetDescription>
                                <div className="flex h-16 items-center border-b border-neutral-100 px-4">
                                    <Brand roleName={roleName} roleHref={roleHref} />
                                </div>
                                <SidebarNav navItems={navItems} onNavigate={() => setDrawerOpen(false)} />
                                <AccountCard />
                            </SheetContent>
                        </Sheet>
                    ) : (
                        <span className="h-11 w-11" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                        <Brand roleName={roleName} roleHref={roleHref} />
                    </div>
                    <NotificationBell />
                </header>

                <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
                    <div className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
