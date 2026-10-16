import { query } from '@/lib/db';

const known = new Set<string>();           // columns / tables seen once: they do not go away, so never asked again
const missingUntil = new Map<string, number>();
const RECHECK_MS = 30_000;                 // a missing one is re-checked now and then, so applying a migration needs no restart

async function check(key: string, sql: string, params: string[]): Promise<boolean> {
    if (known.has(key)) return true;
    const retryAt = missingUntil.get(key);
    if (retryAt && retryAt > Date.now()) return false;
    const [row] = await query<{ n: number }[]>(sql, params);
    if (Number(row?.n) > 0) {
        known.add(key);
        missingUntil.delete(key);
        return true;
    }
    missingUntil.set(key, Date.now() + RECHECK_MS);
    return false;
}

/** Whether the database has this column, so code can keep working before an optional migration is applied. */
export const hasColumn = (table: string, column: string) =>
    check(`${table}.${column}`, 'SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [table, column]);

export const hasTable = (table: string) =>
    check(table, 'SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [table]);

/** Prescription instructions, food timing and "as needed" (21_orders.sql). */
export const hasRxExtras = () => hasColumn('prescription_items', 'as_needed');
/** Lab priority and clinical note (21_orders.sql). */
export const hasLabExtras = () => hasColumn('lab_requests', 'priority');
/** Favourites and lab panels (21_orders.sql). */
export const hasPresets = () => hasTable('doctor_favourites');
