import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { hrFailure } from '@/lib/hr-auth';
import { todayView } from '@/lib/hr';

/** The "Today" card: your shift, whether you are clocked in, and your next shifts. */
export async function GET() {
    const auth = await requirePermission('my.work', 'view');
    if ('error' in auth) return auth.error;
    try {
        return NextResponse.json(await todayView(auth.user.id));
    } catch (err) {
        return hrFailure(err, 'HR today');
    }
}
