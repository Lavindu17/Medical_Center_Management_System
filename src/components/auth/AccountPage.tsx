import { PageHeader } from '@/components/ui/page-header';
import { AccountPanel } from '@/components/auth/AccountPanel';

/** The same Account page for every role: /patient/account, /doctor/account, /admin/account ... */
export function AccountPage() {
    return (
        <div className="max-w-3xl space-y-6">
            <PageHeader title="Account" description="Your name, phone number and password." />
            <AccountPanel />
        </div>
    );
}
