import { createHash } from 'crypto';

/** Pure pieces of the audit trail (no database), so they can be unit tested. */

export const GENESIS_HASH = '0'.repeat(64);

export type AuditAction =
    | 'LOGIN' | 'LOGIN_FAILED' | 'LOGOUT' | 'PASSWORD_CHANGE' | 'PASSWORD_RESET' | 'ACCOUNT_SWITCH'
    | 'VIEW' | 'SEARCH' | 'DOWNLOAD' | 'EXPORT'
    | 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'DISPENSE' | 'REJECT'
    | 'ACCESS_DENIED' | 'VERIFY_CHAIN';

export type AuditEntity =
    | 'SESSION' | 'USER' | 'PATIENT_CHART' | 'PATIENT_PROFILE' | 'APPOINTMENT' | 'CONSULTATION' | 'PRESCRIPTION'
    | 'LAB_REQUEST' | 'LAB_REPORT' | 'LAB_TEST' | 'BILL' | 'FAMILY_LINK' | 'MEDICINE' | 'BATCH'
    | 'DOCTOR_PROFILE' | 'DOCTOR_LEAVE' | 'AUDIT_LOG'
    | 'EMPLOYEE' | 'SHIFT' | 'ATTENDANCE' | 'CORRECTION' | 'LEAVE_REQUEST' | 'LEAVE_TYPE' | 'HOLIDAY' | 'HR_SETTINGS';

export type AuditOutcome = 'SUCCESS' | 'DENIED' | 'FAILURE';

/** The exact values that are hashed. Order and types matter: they must read back from MySQL the way they went in. */
export interface AuditRow {
    occurred_at: string;               // 'YYYY-MM-DD HH:mm:ss.SSS' in UTC
    actor_id: number | null;
    actor_role: string | null;
    actor_name: string | null;
    on_behalf_of_id: number | null;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    patient_id: number | null;
    outcome: string;
    ip: string | null;
    user_agent: string | null;
    details: string | null;
}

export function hashRow(prevHash: string, r: AuditRow): string {
    return createHash('sha256').update(JSON.stringify([
        prevHash, r.occurred_at, r.actor_id, r.actor_role, r.actor_name, r.on_behalf_of_id, r.action,
        r.entity_type, r.entity_id, r.patient_id, r.outcome, r.ip, r.user_agent, r.details,
    ])).digest('hex');
}

/** UTC timestamp in the form MySQL DATETIME(3) stores and returns. */
export function formatUtc(date: Date): string {
    return date.toISOString().replace('T', ' ').replace('Z', '');
}

const SECRET_KEY = /pass(word)?|token|secret|otp|code|hash|authorization|cookie/i;
const MAX_VALUE = 200;
const MAX_JSON = 2000;

/**
 * Details are for context (ids, field names, counts), never for secrets or clinical content. Anything that looks like a
 * credential is dropped, long strings are cut, and the whole thing is capped so one bad call cannot bloat the log.
 */
export function sanitizeDetails(details?: Record<string, unknown> | null): string | null {
    if (!details) return null;
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(details)) {
        if (SECRET_KEY.test(key) || value === undefined) continue;
        if (typeof value === 'string') clean[key] = value.slice(0, MAX_VALUE);
        else if (Array.isArray(value)) clean[key] = value.slice(0, 50).map((v) => (typeof v === 'string' ? v.slice(0, MAX_VALUE) : v));
        else if (value !== null && typeof value === 'object') clean[key] = '[object]';
        else clean[key] = value;
    }
    if (Object.keys(clean).length === 0) return null;
    const text = JSON.stringify(clean);
    return text.length > MAX_JSON ? JSON.stringify({ truncated: true }) : text;
}

/** The client address from standard proxy headers. Only trust these behind a proxy you control. */
export function clientIp(headers: { get(name: string): string | null }): string | null {
    const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const ip = forwarded || headers.get('x-real-ip')?.trim() || null;
    return ip ? ip.slice(0, 45) : null;
}

/** Field names that changed between two objects, for "what was edited" without storing the values. */
export function changedFields(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
    return Object.keys(after).filter((k) => String(before[k] ?? '') !== String(after[k] ?? ''));
}
