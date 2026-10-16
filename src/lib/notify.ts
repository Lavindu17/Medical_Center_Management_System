import { query } from '@/lib/db';
import type { Level, ResourceKey } from '@/lib/access/registry';
import { asDoctor } from '@/lib/names';

export { asDoctor };

/** Anything with mysql2's `execute` (a pool connection inside a transaction) - or null to use the pool. */
type Executor = { execute: (sql: string, params?: any[]) => Promise<any> } | null;

export interface NotificationInput {
    type: string;
    title: string;
    body: string;
    /** In-app path the notification opens, for example /patient/labs */
    link?: string | null;
}

/**
 * Creates an in-app notification for one or more people.
 *
 * Pass the transaction's connection to write inside it: if the action rolls back, so does the
 * notification, and nobody is told about something that never happened. A failure here is logged and
 * swallowed so a notification problem can never break the action that triggered it.
 */
export async function notify(db: Executor, recipients: number | number[], n: NotificationInput): Promise<void> {
    const ids = [...new Set(([] as number[]).concat(recipients))].filter((id) => Number.isInteger(id) && id > 0);
    if (ids.length === 0) return;

    const sql = `INSERT INTO notifications (user_id, type, title, body, link) VALUES ${ids.map(() => '(?, ?, ?, ?, ?)').join(', ')}`;
    const params = ids.flatMap((id) => [id, n.type, n.title.slice(0, 150), n.body.slice(0, 500), n.link ?? null]);
    try {
        if (db) await db.execute(sql, params);
        else await query(sql, params);
    } catch (err) {
        console.error('Could not create notification:', err);
    }
}

/**
 * Ids of the staff who may do something on a screen (for example everyone who can dispense), whatever their job title:
 * a pharmacist whose dispensing was taken away is not told about new prescriptions, and a person given dispensing through a
 * profile is. "view" means any level; the others mean that level.
 */
export async function usersWithPermission(db: Executor, resource: ResourceKey, level: Level): Promise<number[]> {
    try {
        const flag = { view: '(g.can_view + g.can_add + g.can_change + g.can_approve) > 0', add: 'g.can_add = 1', change: 'g.can_change = 1', approve: 'g.can_approve = 1' }[level];
        const sql = `SELECT DISTINCT u.id FROM users u
             JOIN access_profiles p ON (p.system_role = u.role OR p.id IN (SELECT uap.profile_id FROM user_access_profiles uap WHERE uap.user_id = u.id))
             JOIN access_grants g ON g.profile_id = p.id
             WHERE u.role <> 'PATIENT' AND g.resource = ? AND ${flag}`;
        const rows: any[] = db ? (await db.execute(sql, [resource]))[0] : await query<any[]>(sql, [resource]);
        return rows.map((r) => r.id);
    } catch (err) {
        console.error('Could not look up recipients:', err);
        return [];
    }
}

/** Display name for use in a notification, with a safe fallback. */
export async function nameOf(db: Executor, userId: number): Promise<string> {
    try {
        const sql = 'SELECT name FROM users WHERE id = ?';
        const rows: any[] = db ? (await db.execute(sql, [userId]))[0] : await query<any[]>(sql, [userId]);
        return rows[0]?.name ?? 'A patient';
    } catch {
        return 'A patient';
    }
}

/** "2030-01-07" + "10:00" -> "7 Jan 2030, 10:00" for readable messages. */
export function when(date: string | Date, time?: string): string {
    const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
    const day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return time ? `${day}, ${String(time).slice(0, 5)}` : day;
}
