import { createHash } from 'crypto';
import { query } from '@/lib/db';

/** Stable, bounded-length key for an arbitrary identifier (such as an email address). */
export function limiterKey(scope: string, identifier: string) {
    return `${scope}:${createHash('sha256').update(identifier.trim().toLowerCase()).digest('hex')}`;
}

/**
 * Fixed-window counter stored in MySQL (works across server instances).
 * Records one hit and reports whether `max` hits within `windowSeconds` has been exceeded.
 * If the rate_limits table has not been created yet the limiter fails open and logs, rather than taking logins down.
 */
export async function rateLimited(key: string, max: number, windowSeconds: number): Promise<boolean> {
    try {
        await query(
            `INSERT INTO rate_limits (k, window_start, hits) VALUES (?, NOW(), 1)
             ON DUPLICATE KEY UPDATE
                hits = IF(window_start < NOW() - INTERVAL ? SECOND, 1, hits + 1),
                window_start = IF(window_start < NOW() - INTERVAL ? SECOND, NOW(), window_start)`,
            [key, windowSeconds, windowSeconds]);
        const rows = await query<any[]>('SELECT hits FROM rate_limits WHERE k = ?', [key]);
        return Number(rows[0]?.hits ?? 0) > max;
    } catch (err: any) {
        if (err?.errno === 1146) {
            console.error('rate_limits table is missing - run 18_schema_sync.sql. Rate limiting is disabled.');
            return false;
        }
        throw err;
    }
}

/** Clears a counter (for example after a successful login). */
export async function clearLimit(key: string) {
    try {
        await query('DELETE FROM rate_limits WHERE k = ?', [key]);
    } catch (err: any) {
        if (err?.errno !== 1146) throw err;
    }
}
