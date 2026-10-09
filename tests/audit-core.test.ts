import { describe, it, expect } from 'vitest';
import { GENESIS_HASH, changedFields, clientIp, formatUtc, hashRow, sanitizeDetails, type AuditRow } from '@/lib/audit-core';

const row = (over: Partial<AuditRow> = {}): AuditRow => ({
    occurred_at: '2026-10-09 08:15:00.123', actor_id: 4, actor_role: 'DOCTOR', actor_name: 'Dr. Smith', on_behalf_of_id: null,
    action: 'VIEW', entity_type: 'PATIENT_CHART', entity_id: '12', patient_id: 12, outcome: 'SUCCESS', ip: '10.0.0.5', user_agent: 'jest', details: null, ...over,
});

describe('hashRow', () => {
    it('is deterministic', () => {
        expect(hashRow(GENESIS_HASH, row())).toBe(hashRow(GENESIS_HASH, row()));
        expect(hashRow(GENESIS_HASH, row())).toMatch(/^[0-9a-f]{64}$/);
    });
    it('changes when any field changes', () => {
        const base = hashRow(GENESIS_HASH, row());
        for (const change of [{ actor_id: 5 }, { action: 'UPDATE' }, { patient_id: 13 }, { outcome: 'DENIED' }, { details: '{"a":1}' }, { occurred_at: '2026-10-09 08:15:00.124' }, { ip: null }]) {
            expect(hashRow(GENESIS_HASH, row(change))).not.toBe(base);
        }
    });
    it('depends on the previous hash, so rows cannot be reordered or dropped unnoticed', () => {
        expect(hashRow(GENESIS_HASH, row())).not.toBe(hashRow('a'.repeat(64), row()));
    });
});

describe('sanitizeDetails', () => {
    it('keeps ids, names of fields and counts', () => {
        expect(JSON.parse(sanitizeDetails({ fields: ['name', 'phone'], count: 3, status: 'COMPLETED' })!)).toEqual({ fields: ['name', 'phone'], count: 3, status: 'COMPLETED' });
    });
    it('drops anything that looks like a credential', () => {
        const out = JSON.parse(sanitizeDetails({ password: 'x', newPassword: 'y', token: 't', code: '123', authorization: 'a', cookie: 'c', ok: 1 })!);
        expect(out).toEqual({ ok: 1 });
    });
    it('cuts long strings and refuses nested objects', () => {
        const out = JSON.parse(sanitizeDetails({ note: 'x'.repeat(500), nested: { secret: 1 } })!);
        expect(out.note).toHaveLength(200);
        expect(out.nested).toBe('[object]');
    });
    it('returns null for nothing and caps the total size', () => {
        expect(sanitizeDetails(undefined)).toBeNull();
        expect(sanitizeDetails({ password: 'only' })).toBeNull();
        const big = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`k${i}`, 'v'.repeat(190)]));
        expect(JSON.parse(sanitizeDetails(big)!)).toEqual({ truncated: true });
    });
});

describe('helpers', () => {
    it('formats UTC the way DATETIME(3) stores it', () => {
        expect(formatUtc(new Date('2026-10-09T08:15:00.123Z'))).toBe('2026-10-09 08:15:00.123');
    });
    it('takes the first forwarded address', () => {
        expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }))).toBe('203.0.113.9');
        expect(clientIp(new Headers({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2');
        expect(clientIp(new Headers())).toBeNull();
    });
    it('lists changed field names without values', () => {
        expect(changedFields({ name: 'A', phone: '1', address: 'x' }, { name: 'A', phone: '2', address: null })).toEqual(['phone', 'address']);
    });
});
