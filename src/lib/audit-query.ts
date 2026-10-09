import 'server-only';
import { pool } from '@/lib/db';

export interface AuditFilters {
    actor?: number;
    patient?: number;
    action?: string;
    entity?: string;
    outcome?: string;
    from?: string;      // YYYY-MM-DD, inclusive
    to?: string;        // YYYY-MM-DD, inclusive
    cursor?: number;    // rows older than this id
}

export interface AuditListRow {
    id: number;
    occurred_at: string;
    actor_id: number | null;
    actor_role: string | null;
    actor_name: string | null;
    on_behalf_of_id: number | null;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    patient_id: number | null;
    patient_name: string | null;
    outcome: string;
    ip: string | null;
    details: string | null;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const WORD = /^[A-Z_]{2,30}$/;

/** Reads the filters from a URL, accepting only well-formed values (anything else is ignored, never passed to SQL). */
export function parseFilters(params: URLSearchParams): AuditFilters {
    const num = (key: string) => {
        const n = Number(params.get(key));
        return Number.isInteger(n) && n > 0 ? n : undefined;
    };
    const word = (key: string) => {
        const v = params.get(key)?.toUpperCase();
        return v && WORD.test(v) ? v : undefined;
    };
    const day = (key: string) => {
        const v = params.get(key);
        return v && DAY.test(v) ? v : undefined;
    };
    return {
        actor: num('actor'), patient: num('patient'), action: word('action'), entity: word('entity'),
        outcome: word('outcome'), from: day('from'), to: day('to'), cursor: num('cursor'),
    };
}

function where(f: AuditFilters): { sql: string; args: any[] } {
    const parts: string[] = [];
    const args: any[] = [];
    const add = (sql: string, value: unknown) => { parts.push(sql); args.push(value); };
    if (f.actor) add('a.actor_id = ?', f.actor);
    if (f.patient) add('a.patient_id = ?', f.patient);
    if (f.action) add('a.action = ?', f.action);
    if (f.entity) add('a.entity_type = ?', f.entity);
    if (f.outcome) add('a.outcome = ?', f.outcome);
    if (f.from) add('a.occurred_at >= ?', `${f.from} 00:00:00.000`);
    if (f.to) add('a.occurred_at < DATE_ADD(?, INTERVAL 1 DAY)', f.to);
    if (f.cursor) add('a.id < ?', f.cursor);
    return { sql: parts.length ? `WHERE ${parts.join(' AND ')}` : '', args };
}

export async function listAudit(filters: AuditFilters, limit: number): Promise<AuditListRow[]> {
    const w = where(filters);
    const [rows]: any = await pool.query(
        `SELECT a.id, DATE_FORMAT(a.occurred_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS occurred_at, a.actor_id, a.actor_role, a.actor_name,
                a.on_behalf_of_id, a.action, a.entity_type, a.entity_id, a.patient_id, p.name AS patient_name, a.outcome, a.ip, a.details
         FROM audit_log a LEFT JOIN users p ON p.id = a.patient_id
         ${w.sql} ORDER BY a.id DESC LIMIT ?`,
        [...w.args, limit]);
    return rows;
}

/** A cell that starts with = + - or @ would run as a formula when the CSV is opened in a spreadsheet. */
function csvCell(value: unknown): string {
    let text = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const CSV_COLUMNS = ['id', 'occurred_at_utc', 'actor_id', 'actor_role', 'actor_name', 'on_behalf_of_id', 'action', 'entity_type', 'entity_id', 'patient_id', 'patient_name', 'outcome', 'ip', 'details'] as const;

export function toCsv(rows: AuditListRow[]): string {
    const lines = [CSV_COLUMNS.join(',')];
    for (const r of rows) {
        lines.push([r.id, r.occurred_at, r.actor_id, r.actor_role, r.actor_name, r.on_behalf_of_id, r.action, r.entity_type, r.entity_id, r.patient_id, r.patient_name, r.outcome, r.ip, r.details].map(csvCell).join(','));
    }
    return lines.join('\r\n') + '\r\n';
}

/** What a patient may see about people who handled their record: who, in what role, what they did, and when. No addresses, no details. */
export async function patientAccessHistory(patientId: number, limit: number, cursor?: number) {
    const [rows]: any = await pool.query(
        `SELECT id, DATE_FORMAT(occurred_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS occurred_at, actor_name, actor_role, on_behalf_of_id, action, entity_type
         FROM audit_log
         WHERE patient_id = ? AND outcome = 'SUCCESS' AND (actor_id IS NULL OR actor_id <> ?)
           AND action IN ('VIEW', 'DOWNLOAD', 'CREATE', 'UPDATE', 'STATUS_CHANGE', 'DISPENSE', 'REJECT')
           ${cursor ? 'AND id < ?' : ''}
         ORDER BY id DESC LIMIT ?`,
        cursor ? [patientId, patientId, cursor, limit] : [patientId, patientId, limit]);
    return rows as { id: number; occurred_at: string; actor_name: string | null; actor_role: string | null; on_behalf_of_id: number | null; action: string; entity_type: string | null }[];
}
