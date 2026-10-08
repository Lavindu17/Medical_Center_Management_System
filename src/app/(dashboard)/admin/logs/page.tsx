import { ScrollText } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/state-views';

export default function SystemLogsPage() {
    return (
        <div className="space-y-6">
            <PageHeader title="System Logs" description="System activity and audit trail." />
            <EmptyState
                icon={ScrollText}
                title="The log viewer is not available yet"
                description="Sign-ins, record changes and other activity will be listed here once audit logging is switched on."
            />
        </div>
    );
}
