import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { grantsFor } from '@/lib/access/resolve';

/** What the signed-in person may do, for the menu and the page guards. Patients get nothing here: their side is fixed. */
export async function GET() {
    const auth = await requireRole();
    if ('error' in auth) return auth.error;
    try {
        const { user } = auth;
        const grants = user.role === 'PATIENT' ? {} : await grantsFor(user);
        return NextResponse.json({ role: user.role, grants });
    } catch (error) {
        console.error('Access lookup error:', error);
        return NextResponse.json({ message: 'Could not load your access' }, { status: 500 });
    }
}
