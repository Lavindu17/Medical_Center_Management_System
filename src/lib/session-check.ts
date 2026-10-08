import { query } from '@/lib/db';

/**
 * A signed token proves who logged in, not that the account is still allowed in. This re-checks the
 * database so a deleted account, a changed role or a password change/reset ends existing sessions
 * immediately instead of after the token's 24 hours.
 */
export async function isSessionCurrent(payload: { id?: unknown; role?: unknown; iat?: unknown }): Promise<boolean> {
    if (typeof payload.id !== 'number') return false;

    let rows: any[];
    try {
        rows = await query<any[]>('SELECT role, UNIX_TIMESTAMP(password_changed_at) AS changed FROM users WHERE id = ?', [payload.id]);
    } catch (err: any) {
        if (err?.errno !== 1054) throw err;
        // password_changed_at not migrated yet (18_schema_sync.sql): still enforce existence and role
        console.error('users.password_changed_at is missing - run 18_schema_sync.sql to enable session revocation.');
        rows = await query<any[]>('SELECT role, NULL AS changed FROM users WHERE id = ?', [payload.id]);
    }

    if (rows.length === 0) return false;
    if (rows[0].role !== payload.role) return false;
    if (rows[0].changed && typeof payload.iat === 'number' && payload.iat < Math.floor(Number(rows[0].changed))) return false;
    return true;
}
