import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireRole } from '@/lib/api-auth';

const ALL_ROLES = ['PATIENT', 'DOCTOR', 'PHARMACIST', 'LAB_ASSISTANT', 'RECEPTIONIST', 'ADMIN'] as const;

// GET the signed-in user's notifications, newest first. Everyone only ever sees their own.
//   ?limit=20 (max 100)   ?unread=1 only unread   ?before=<id> older than this id (paging)   ?countOnly=1
export async function GET(req: Request) {
    const auth = await requireRole(...ALL_ROLES);
    if ('error' in auth) return auth.error;
    const { user } = auth;

    try {
        const params = new URL(req.url).searchParams;

        const unread = await query<any[]>('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = FALSE', [user.id]);
        const unreadCount = Number(unread[0].n);
        if (params.get('countOnly') === '1') return NextResponse.json({ unreadCount });

        const limit = Math.min(100, Math.max(1, Number(params.get('limit')) || 20));
        const before = Number(params.get('before'));
        const where = ['user_id = ?'];
        const args: any[] = [user.id];
        if (params.get('unread') === '1') where.push('is_read = FALSE');
        if (Number.isInteger(before) && before > 0) { where.push('id < ?'); args.push(before); }

        // LIMIT is inlined: it is a validated integer, and prepared statements do not accept it as a parameter here
        const notifications = await query<any[]>(
            `SELECT id, type, title, body, link, is_read AS isRead, created_at AS createdAt
             FROM notifications WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ${limit}`, args);

        return NextResponse.json({
            notifications: notifications.map((n) => ({ ...n, isRead: Boolean(n.isRead) })),
            unreadCount,
        });
    } catch (error) {
        console.error('Notifications GET error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
