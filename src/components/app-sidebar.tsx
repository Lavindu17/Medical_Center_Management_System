'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { LogOut, Menu, HeartPulse, LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface NavItem {
    icon: LucideIcon;
    label: string;
    href: string;
}

interface AppSidebarProps {
    navItems: NavItem[];
    roleName: string;
    roleHref: string;
}

function SidebarNav({ navItems, onNavigate }: { navItems: NavItem[]; onNavigate?: () => void }) {
    const pathname = usePathname();
    return (
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
            {navItems.map((item, idx) => {
                const isActive = pathname === item.href;
                return (
                    <motion.div
                        key={item.href}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04, duration: 0.2 }}
                    >
                        <Link
                            href={item.href}
                            onClick={onNavigate}
                            className={cn(
                                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative',
                                isActive
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                            )}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="sidebar-active"
                                    className="absolute inset-0 bg-emerald-600 rounded-lg"
                                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                />
                            )}
                            <item.icon className={cn(
                                'h-4 w-4 relative z-10 flex-shrink-0 transition-transform duration-200',
                                isActive ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-600'
                            )} />
                            <span className="relative z-10 truncate">{item.label}</span>
                            {isActive && (
                                <span className="relative z-10 ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />
                            )}
                        </Link>
                    </motion.div>
                );
            })}
        </nav>
    );
}

export function AppSidebar({ navItems, roleName, roleHref }: AppSidebarProps) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [user, setUser] = useState<{name: string, email: string} | null>(null);

    useEffect(() => {
        fetch('/api/auth/session')
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data?.user) {
                    setUser({ name: data.user.name, email: data.user.email });
                }
            })
            .catch(() => {});
    }, []);

    const SidebarShell = ({ children }: { children: React.ReactNode }) => (
        <div className="flex flex-col h-full bg-white border-r border-neutral-200">
            {/* Logo */}
            <div className="h-16 flex items-center gap-3 px-5 border-b border-neutral-100">
                <div className="h-8 w-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                    <HeartPulse className="h-4 w-4 text-white" />
                </div>
                <Link href={roleHref} className="flex flex-col leading-none">
                    <span className="font-bold text-sm text-neutral-900 tracking-tight">Sethro Medical</span>
                    <span className="text-[10px] text-emerald-600 font-medium uppercase tracking-widest">{roleName}</span>
                </Link>
            </div>

            {children}

            {/* User Info & Sign out */}
            <div className="p-3 border-t border-neutral-100 space-y-2 bg-neutral-50/50">
                {user && (
                    <div className="px-3 py-2 flex flex-col">
                        <span className="text-sm font-semibold text-neutral-900 truncate">{user.name}</span>
                        <span className="text-xs text-neutral-500 truncate">{user.email}</span>
                    </div>
                )}
                <a
                    href="/api/auth/logout"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors duration-200 w-full"
                >
                    <LogOut className="h-4 w-4 flex-shrink-0" />
                    Sign Out
                </a>
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop */}
            <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 z-50">
                <SidebarShell>
                    <SidebarNav navItems={navItems} />
                </SidebarShell>
            </aside>

            {/* Mobile trigger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden fixed top-3 left-3 z-50 bg-white border shadow-sm"
                    >
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Open menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-64 border-0">
                    <SheetTitle className="sr-only">Navigation</SheetTitle>
                    <SidebarShell>
                        <SidebarNav navItems={navItems} onNavigate={() => setMobileOpen(false)} />
                    </SidebarShell>
                </SheetContent>
            </Sheet>
        </>
    );
}
