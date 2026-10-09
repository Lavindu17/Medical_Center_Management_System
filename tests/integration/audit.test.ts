import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { pool, query } from '@/lib/db';
import { audit, verifyChain } from '@/lib/audit';
import { one, rows } from './helpers';

// The audit trail itself: appending, the hash chain, concurrency, and the append-only guarantee.

afterAll(async () => { await pool.end(); });

const SQL = fs.readFileSync(path.resolve(__dirname, '../../mydocumentations/databas_setup_querries/19_audit_log.sql'), 'utf8');
const doctor = { id: 2, role: 'DOCTOR', name: 'Dr. John Smith' };
const marker = () => `t${Date.now()}${Math.random().toString(36).slice(2, 7)}`;

beforeAll(async () => {
    const c = await pool.getConnection();
    try { await c.query(SQL); } finally { c.release(); }   // idempotent: proves the migration can run twice
});

describe('audit()', () => {
    it('appends a row with who, what, whose record and outcome', async () => {
        const id = marker();
        await audit(doctor, { action: 'VIEW', entity: 'PATIENT_CHART', entityId: id, patientId: 4, details: { via: 'test', password: 'must-not-appear' } });
        const r = await one(`SELECT * FROM audit_log WHERE entity_id = ?`, [id]);
        expect(r).toMatchObject({ actor_id: 2, actor_role: 'DOCTOR', actor_name: 'Dr. John Smith', action: 'VIEW', entity_type: 'PATIENT_CHART', patient_id: 4, outcome: 'SUCCESS', on_behalf_of_id: null });
        expect(JSON.parse(r.details)).toEqual({ via: 'test' });
        expect(r.hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('records the human behind a family switch, and the account they acted as', async () => {
        const id = marker();
        await audit({ id: 5, role: 'PATIENT', name: 'Bob', actorId: 4, actorName: 'Alice' }, { action: 'VIEW', entity: 'PATIENT_CHART', entityId: id, patientId: 5 });
        expect(await one(`SELECT actor_id, actor_name, on_behalf_of_id FROM audit_log WHERE entity_id = ?`, [id]))
            .toMatchObject({ actor_id: 4, actor_name: 'Alice', on_behalf_of_id: 5 });
    });

    it('accepts events with no signed-in user (failed sign-in)', async () => {
        const id = marker();
        await audit(null, { action: 'LOGIN_FAILED', entity: 'SESSION', entityId: id, outcome: 'FAILURE', details: { email: 'x@y.test' } });
        expect(await one(`SELECT actor_id, outcome FROM audit_log WHERE entity_id = ?`, [id])).toMatchObject({ actor_id: null, outcome: 'FAILURE' });
    });

    it('never throws, even when it cannot write', async () => {
        await expect(audit(doctor, { action: 'VIEW', entity: 'PATIENT_CHART', entityId: 'x'.repeat(5000) })).resolves.toBeUndefined();
    });
});

describe('hash chain', () => {
    it('verifies after normal use', async () => {
        const report = await verifyChain();
        expect(report.ok).toBe(true);
        expect(report.checked).toBeGreaterThan(0);
        expect(report.head).toMatch(/^[0-9a-f]{64}$/);
    });

    it('stays one unbroken chain under concurrent writers', async () => {
        const tag = marker();
        await Promise.all(Array.from({ length: 25 }, (_, i) => audit(doctor, { action: 'VIEW', entity: 'PATIENT_CHART', entityId: `${tag}-${i}`, patientId: 4 })));
        const written = await rows(`SELECT id FROM audit_log WHERE entity_id LIKE ?`, [`${tag}-%`]);
        expect(written).toHaveLength(25);
        expect((await verifyChain()).ok).toBe(true);
        const forks = await one(`SELECT COUNT(*) AS n FROM (SELECT prev_hash FROM audit_log GROUP BY prev_hash HAVING COUNT(*) > 1) d`);
        expect(Number(forks.n)).toBe(0);
    });
});

describe('append-only', () => {
    it('refuses UPDATE and DELETE', async () => {
        await audit(doctor, { action: 'VIEW', entity: 'PATIENT_CHART', entityId: marker() });
        await expect(query(`UPDATE audit_log SET actor_id = 99 ORDER BY id DESC LIMIT 1`)).rejects.toThrow(/append-only/);
        await expect(query(`DELETE FROM audit_log ORDER BY id DESC LIMIT 1`)).rejects.toThrow(/append-only/);
    });

    // Someone with the power to drop the triggers (a database administrator, not the application) can still edit rows.
    // The chain is what makes that visible. This test acts as that administrator, then puts everything back.
    describe('tamper detection (as a database administrator)', () => {
        const dropTriggers = async () => { await pool.query('DROP TRIGGER IF EXISTS audit_log_no_update'); await pool.query('DROP TRIGGER IF EXISTS audit_log_no_delete'); };
        const restoreTriggers = async () => { const c = await pool.getConnection(); try { await c.query(SQL); } finally { c.release(); } };

        it('detects an edited row', async () => {
            const id = marker();
            await audit(doctor, { action: 'VIEW', entity: 'PATIENT_CHART', entityId: id, patientId: 4 });
            const target = await one(`SELECT id, actor_id FROM audit_log WHERE entity_id = ?`, [id]);
            await dropTriggers();
            try {
                await query(`UPDATE audit_log SET actor_id = 999 WHERE id = ?`, [target.id]);
                const report = await verifyChain();
                expect(report.ok).toBe(false);
                expect(report.firstBadId).toBe(target.id);
                expect(report.reason).toMatch(/changed/);
            } finally {
                await query(`UPDATE audit_log SET actor_id = ? WHERE id = ?`, [target.actor_id, target.id]);
                await restoreTriggers();
            }
            expect((await verifyChain()).ok).toBe(true);
        });

        it('detects a deleted row', async () => {
            const tag = marker();
            for (let i = 0; i < 3; i++) await audit(doctor, { action: 'VIEW', entity: 'PATIENT_CHART', entityId: `${tag}-${i}`, patientId: 4 });
            const middle = await one(`SELECT * FROM audit_log WHERE entity_id = ?`, [`${tag}-1`]);
            await dropTriggers();
            try {
                await query(`DELETE FROM audit_log WHERE id = ?`, [middle.id]);
                const report = await verifyChain();
                expect(report.ok).toBe(false);
                expect(report.reason).toMatch(/link/);
            } finally {
                const cols = Object.keys(middle);
                await query(`INSERT INTO audit_log (${cols.map((c) => `\`${c}\``).join(',')}) VALUES (${cols.map(() => '?').join(',')})`, cols.map((c) => middle[c]));
                await restoreTriggers();
            }
            expect((await verifyChain()).ok).toBe(true);
        });
    });
});
