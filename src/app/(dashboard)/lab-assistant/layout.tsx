
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, TestTube, LogOut, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function LabAssistantLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    };

    const navItems = [
        {
            title: 'Pending Requests',
            href: '/lab-assistant',
            icon: LayoutDashboard,
        },
        {
            title: 'Manage Tests',
            href: '/lab-assistant/tests',
            icon: TestTube,
        },
    ];

    return (
        <div className="flex min-h-screen w-full flex-col md:flex-row bg-gray-50/40">
            <aside className="w-full md:w-64 border-r bg-white min-h-screen hidden md:flex flex-col">
                <div className="p-6 border-b">
                    <h1 className="text-xl font-bold flex items-center gap-2 text-emerald-700">
                        <TestTube className="h-6 w-6" />
                        Sethro Lab
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">Lab Assistant Portal</p>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                    }`}
                            >
                                <Icon className="h-4 w-4" />
                                {item.title}
                            </Link>
                        );
                    })}
                </nav>
                <div className="p-4 border-t">
                    <Button variant="ghost" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                    </Button>
                </div>
            </aside>

            {/* Mobile Nav would go here (omitted for brevity, assume responsive hidden sidebar for now) */}

            <main className="flex-1 p-6 md:p-8 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
