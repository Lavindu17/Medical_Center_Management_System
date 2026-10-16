import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/api-auth';
import { grantsFor } from '@/lib/access/resolve';
import { homeFor } from '@/lib/access/screens';

export const dynamic = 'force-dynamic';

// Where staff land after signing in: the dashboard that suits their role, or the first screen their permissions open.
export default async function StaffHome() {
    const user = await getSessionUser();
    if (!user) redirect('/login');
    if (user.role === 'PATIENT') redirect('/patient');
    redirect(homeFor(user.role, await grantsFor(user)));
}
