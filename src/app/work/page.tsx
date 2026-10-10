import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/api-auth';

const HOME: Record<string, string> = {
    DOCTOR: '/doctor/work', PHARMACIST: '/pharmacist/work', LAB_ASSISTANT: '/lab-assistant/work',
    RECEPTIONIST: '/receptionist/work', ADMIN: '/admin/work', HR_MANAGER: '/hr/work',
};

// A link that works for every member of staff (notifications use it): it sends each person to their own My Work page.
export default async function WorkRedirect() {
    const user = await getSessionUser();
    redirect(user ? (HOME[user.role] ?? '/') : '/login');
}
