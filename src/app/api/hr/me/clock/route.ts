import { NextResponse } from 'next/server';
import { z } from 'zod';
import { audit } from '@/lib/audit';
import { parseBody } from '@/lib/validate';
import { requireStaff, hrFailure, requestIp } from '@/lib/hr-auth';
import { clockIn, clockOut } from '@/lib/hr';

const schema = z.object({ action: z.enum(['IN', 'OUT'], { message: 'action must be IN or OUT' }) });

/** Clock in or out. The time is always the server's; the browser's clock is never used. */
export async function POST(req: Request) {
    const auth = await requireStaff();
    if ('error' in auth) return auth.error;
    const body = await parseBody(req, schema);
    if ('error' in body) return body.error;

    try {
        const ip = await requestIp();
        const result = body.data.action === 'IN' ? await clockIn(auth.user.id, ip) : await clockOut(auth.user.id, ip);
        await audit(auth.user, {
            action: body.data.action === 'IN' ? 'CREATE' : 'UPDATE', entity: 'ATTENDANCE', entityId: result.recordId,
            details: { clock: body.data.action, late: result.lateMinutes ?? 0, unscheduled: result.unscheduled ?? false },
        });
        return NextResponse.json(result);
    } catch (err) {
        return hrFailure(err, 'HR clock');
    }
}
