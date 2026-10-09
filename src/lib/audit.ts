import 'server-only';
import { pool } from '@/lib/db';
import {
    GENESIS_HASH, formatUtc, hashRow, sanitizeDetails, clientIp,
    type AuditAction, type AuditEntity, type AuditOutcome, type AuditRow,
} from '@/lib/audit-core';

export type { AuditAction, AuditEntity, AuditOutcome } from '@/lib/audit-core';
export { changedFields } from '@/lib/audit-core';

/** Who is acting. A SessionUser fits; `actorId`/`actorName` are set when a family member is acting as someone else. */
export interface AuditActor {
    id: number;
    role: string;
    name?: string | null;
    actorId?: number;
    actorName?: string;
}

export interface AuditEvent {
    action: AuditAction;
    entity?: AuditEntity;
    entityId?: string | number | null;
    /** Whose record this touches. Drives the patient's own "who accessed my record" list. */
    patientId?: number | null;
    outcome?: AuditOutcome;
    /** Ids, field names, counts. Never notes, results, passwords or tokens (sanitised regardless). */
    details?: Record<string, unknown>;
}

const MAX_RETRIES = 25;

/**
 * Writers inside this process take turns, so they never collide with each other. Collisions can then only come from
 * another server process, which the UNIQUE prev_hash catches (below) and a short random wait resolves.
 */
let writeQueue: Promise<unknown> = Promise.resolve();
const enqueue = <T,>(job: () => Promise<T>): Promise<T> => {
    const run = writeQueue.then(job, job);
    writeQueue = run.catch(() => undefined);
    return run;
};
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestContext(): Promise<{ ip: string | null; userAgent: string | null }> {
    try {
        const { headers } = await import('next/headers');
        const h = await headers();
        return { ip: clientIp(h), userAgent: h.get('user-agent')?.slice(0, 255) ?? null };
    } catch {
        return { ip: null, userAgent: null };   // outside a request (tests, scripts)
    }
}

/**
 * Appends one event to the audit trail. It never throws: a failing audit write must not take patient care down, so a
 * failure is reported loudly on the server log instead. (That is the usual availability choice; an operator should
 * alert on the AUDIT_WRITE_FAILED line.)
 *
 * Rows are chained: each stores the hash of the one before. Two writers racing for the same predecessor collide on
 * the UNIQUE prev_hash and the loser simply re-reads and retries, so the chain can never fork.
 */
export async function audit(actor: AuditActor | null | undefined, event: AuditEvent): Promise<void> {
    try {
        const ctx = await requestContext();
        const actingAs = Boolean(actor?.actorId);
        const row: AuditRow = {
            occurred_at: formatUtc(new Date()),
            actor_id: actor ? (actor.actorId ?? actor.id) : null,
            actor_role: actor?.role ?? null,
            actor_name: actor ? ((actingAs ? actor.actorName : actor.name) ?? null)?.slice(0, 255) ?? null : null,
            on_behalf_of_id: actingAs && actor ? actor.id : null,
            action: event.action,
            entity_type: event.entity ?? null,
            entity_id: event.entityId === undefined || event.entityId === null ? null : String(event.entityId).slice(0, 64),
            patient_id: event.patientId ?? null,
            outcome: event.outcome ?? 'SUCCESS',
            ip: ctx.ip,
            user_agent: ctx.userAgent,
            details: sanitizeDetails(event.details),
        };

        await enqueue(async () => {
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            const [last]: any = await pool.query('SELECT `hash` FROM audit_log ORDER BY id DESC LIMIT 1');
            const prev = last[0]?.hash ?? GENESIS_HASH;
            try {
                await pool.execute(
                    `INSERT INTO audit_log (occurred_at, actor_id, actor_role, actor_name, on_behalf_of_id, action, entity_type, entity_id,
                                            patient_id, outcome, ip, user_agent, details, prev_hash, \`hash\`)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [row.occurred_at, row.actor_id, row.actor_role, row.actor_name, row.on_behalf_of_id, row.action, row.entity_type,
                        row.entity_id, row.patient_id, row.outcome, row.ip, row.user_agent, row.details, prev, hashRow(prev, row)],
                );
                return;
            } catch (err: any) {
                if (err?.code !== 'ER_DUP_ENTRY') throw err;
                await pause(Math.random() * 15 * (attempt + 1));   // another server appended first: re-read the head and retry
            }
        }
        throw new Error('could not append after repeated chain collisions');
        });
    } catch (err) {
        console.error('AUDIT_WRITE_FAILED', { action: event.action, entity: event.entity, error: err instanceof Error ? err.message : err });
    }
}

/**
 * For reads of a patient's record. People looking at their own record are not logged (the patient's access history
 * is about everyone else), but a family member acting as the patient is: the human behind the session is the actor.
 */
export async function auditAccess(actor: AuditActor, event: AuditEvent): Promise<void> {
    if (event.patientId != null && event.patientId === actor.id && !actor.actorId) return;
    await audit(actor, event);
}

export interface ChainReport {
    ok: boolean;
    checked: number;
    /** Hash of the newest row. Store it somewhere outside the database: it is what proves rows were not cut off the end. */
    head: string | null;
    firstBadId?: number;
    reason?: string;
}

/** Recomputes every hash and link, oldest first, and reports the first row that does not match. */
export async function verifyChain(batchSize = 1000): Promise<ChainReport> {
    let lastId = 0;
    let prev = GENESIS_HASH;
    let checked = 0;
    for (;;) {
        const [rows]: any = await pool.query(
            `SELECT id, CAST(occurred_at AS CHAR) AS occurred_at, actor_id, actor_role, actor_name, on_behalf_of_id, action, entity_type,
                    entity_id, patient_id, outcome, ip, user_agent, details, prev_hash, \`hash\`
             FROM audit_log WHERE id > ? ORDER BY id ASC LIMIT ?`, [lastId, batchSize]);
        if (rows.length === 0) return { ok: true, checked, head: checked === 0 ? null : prev };
        for (const r of rows) {
            if (r.prev_hash !== prev) return { ok: false, checked, head: null, firstBadId: r.id, reason: 'The link to the previous row is broken (a row was removed or reordered).' };
            if (hashRow(prev, r) !== r.hash) return { ok: false, checked, head: null, firstBadId: r.id, reason: 'The row content does not match its hash (it was changed).' };
            prev = r.hash;
            checked++;
            lastId = r.id;
        }
    }
}
