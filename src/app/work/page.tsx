import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/api-auth';

// A link that works for every member of staff (notifications use it): it opens their own My Work page.
export default async function WorkRedirect() {
    const user = await getSessionUser();
    redirect(user ? (user.role === 'PATIENT' ? '/patient' : '/staff/work') : '/login');
}
