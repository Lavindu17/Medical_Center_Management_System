import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { EmptyState } from '@/components/ui/state-views';
import { getSessionUser } from '@/lib/api-auth';
import { grantsFor } from '@/lib/access/resolve';
import { homeFor } from '@/lib/access/screens';

export const dynamic = 'force-dynamic';

// Where staff land after signing in: the dashboard that suits their role, or the first screen their permissions open.
export default async function StaffHome() {
    const user = await getSessionUser();
    if (!user) redirect('/login');
    if (user.role === 'PATIENT') redirect('/patient');
    const home = homeFor(user.role, await grantsFor(user));
    if (home) redirect(home);
    return (
        <EmptyState icon={ShieldCheck} title="Your account has no access yet" description="An administrator needs to give you access to the screens you work with. Please ask them." />
    );
}
