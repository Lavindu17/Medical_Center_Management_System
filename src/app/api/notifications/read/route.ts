import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { requireRole } from '@/lib/api-auth';

const ALL_ROLES = ['PATIENT', 'DOCTOR', 'PHARMACIST', 'LAB_ASSISTANT', 'RECEPTIONIST', 'ADMIN'] as const;

const schema = z.union([
    z.object({ all: z.literal(true) }),
    z.object({ ids: z.array(z.number().int().positive()).min(1).max(200) }),
]);

// POST mark notifications as read: { ids: [1, 2] } or { all: true }. Only the caller's own can be touched.
export async function POST(req: Request) {
    const auth = await requireRole(...ALL_ROLES);
    if ('error' in auth) return auth.error;
    const { user } = auth;

    try {
        const parsed = schema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ message: 'Send { ids: [...] } or { all: true }' }, { status: 400 });
        }

        if ('all' in parsed.data) {
            await query('UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE', [user.id]);
        } else {
            const ids = parsed.data.ids;
            await query(
                `UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND id IN (${ids.map(() => '?').join(', ')})`,
                [user.id, ...ids]);
        }

        // Housekeeping: read notifications older than 90 days are of no use to anyone
        await query('DELETE FROM notifications WHERE user_id = ? AND is_read = TRUE AND created_at < NOW() - INTERVAL 90 DAY', [user.id]);

        const unread = await query<any[]>('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = FALSE', [user.id]);
        return NextResponse.json({ unreadCount: Number(unread[0].n) });
    } catch (error) {
        console.error('Notifications read error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
