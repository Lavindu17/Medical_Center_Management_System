'use client';

import { ChangePasswordCard } from '@/components/auth/ChangePasswordCard';

export function SettingsPageLayout({ title = 'Account Settings' }: { title?: string }) {
    return (
        <div className="p-8 max-w-3xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold">{title}</h1>
                <p className="text-neutral-500">Manage your account security and preferences.</p>
            </div>
            
            <ChangePasswordCard />
        </div>
    );
}
