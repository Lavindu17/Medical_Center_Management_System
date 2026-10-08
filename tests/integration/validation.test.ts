import { describe, it, expect, afterAll } from 'vitest';
import { pool } from '@/lib/db';
import { as, post, ALICE, RECEPTIONIST, PHARMACIST, DOCTOR } from './helpers';

// Bad input gets a 400 with a readable { message } (never a 500), and a signed-in user of the wrong role gets 403 (not 401).

afterAll(async () => { await pool.end(); });

const labTest = (body: unknown) => import('@/app/api/lab-assistant/tests/route').then((m) => m.POST(post('/x', body)));
const payBill = (body: unknown) => import('@/app/api/receptionist/billing/route').then((m) => m.POST(post('/x', body)));
const profile = (body: unknown) => import('@/app/api/patient/profile/route').then((m) => m.POST(post('/x', body)));

describe('lab test creation', () => {
    it.each([
        [{ name: 'X', price: 100, cost_price: 50 }, /name/i],
        [{ name: 'Valid Test', price: -5, cost_price: 1 }, /selling price/i],
        [{ name: 'Valid Test', price: 'abc', cost_price: 1 }, /price/i],
        [{ name: 'Valid Test', price: 100, cost_price: -1 }, /cost price/i],
    ])('rejects %j', async (body, message) => {
        await as('LAB_ASSISTANT', 7);
        const res = await labTest(body);
        expect(res.status).toBe(400);
        expect((await res.json()).message).toMatch(message);
    });
});

describe('paying a bill', () => {
    it('rejects an unknown payment method with 400 instead of a database error', async () => {
        await as('RECEPTIONIST', RECEPTIONIST);
        const res = await payBill({ bill_id: 1, payment_method: 'BITCOIN' });
        expect(res.status).toBe(400);
        expect((await res.json()).message).toMatch(/payment method/i);
    });
    it('rejects a missing or non-numeric bill id', async () => {
        await as('RECEPTIONIST', RECEPTIONIST);
        expect((await payBill({ payment_method: 'CASH' })).status).toBe(400);
        expect((await payBill({ bill_id: 'x', payment_method: 'CASH' })).status).toBe(400);
    });
});

describe('patient profile update', () => {
    it('rejects a too-short name and a bad phone number', async () => {
        await as('PATIENT', ALICE);
        const shortName = await profile({ id: ALICE, name: 'A', address: 'x' });
        expect(shortName.status).toBe(400);
        expect((await shortName.json()).field).toBe('name');
        const badPhone = await profile({ id: ALICE, name: 'Alice Fine', phone: 'call me', address: 'x' });
        expect(badPhone.status).toBe(400);
        expect((await badPhone.json()).field).toBe('phone');
    });
    it('still forbids editing someone else\'s profile', async () => {
        await as('PATIENT', ALICE);
        expect((await profile({ id: ALICE + 1, name: 'Mallory', address: 'x' })).status).toBe(403);
    });
});

describe('wrong role gets 403, no session gets 401', () => {
    const cases: [string, () => Promise<Response>, Parameters<typeof as>][] = [
        ['pharmacist stats as patient', () => import('@/app/api/pharmacist/stats/route').then((m) => m.GET(new Request('http://x'))), ['PATIENT', ALICE]],
        ['doctor earnings as receptionist', () => import('@/app/api/doctor/earnings/route').then((m) => m.GET(new Request('http://x'))), ['RECEPTIONIST', RECEPTIONIST]],
        ['pharmacist alerts as doctor', () => import('@/app/api/pharmacist/alerts/route').then((m) => m.GET()), ['DOCTOR', DOCTOR]],
        ['receptionist billing as pharmacist', () => import('@/app/api/receptionist/billing/route').then((m) => m.GET(new Request('http://x?status=PENDING'))), ['PHARMACIST', PHARMACIST]],
    ];
    it.each(cases)('%s', async (_name, call, identity) => {
        await as(...identity);
        expect((await call()).status).toBe(403);
    });
});

describe('consultation save validation', () => {
    const save = (body: unknown) => import('@/app/api/doctor/consultation/save/route').then((m) => m.POST(post('/x', body)));
    const base = { appointmentId: 1, status: 'ONGOING' };
    it.each([
        [{ status: 'ONGOING' }, /appointmentId/],
        [{ ...base, status: 'DONE' }, /status must be/],
        [{ ...base, vitals: { weight: -3 } }, /weight must be a non-negative/],
        [{ ...base, vitals: { pulse: 'fast' } }, /pulse must be a non-negative/],
        [{ ...base, prescription: 'aspirin' }, /prescription must be an array/],
        [{ ...base, prescription: [{ medicineId: 1, quantity: 2, dosage: '', frequency: 'daily', duration: '3d' }] }, /dosage is required/],
        [{ ...base, prescription: [{ medicineId: 1, quantity: 0, dosage: '1', frequency: 'daily', duration: '3d' }] }, /quantity/],
        [{ ...base, labRequestIds: ['x'] }, /labRequestIds/],
    ])('rejects %j', async (body, message) => {
        await as('DOCTOR', DOCTOR);
        const res = await save(body);
        expect(res.status).toBe(400);
        expect((await res.json()).message).toMatch(message);
    });
});

describe('dispense validation', () => {
    const dispense = (body: unknown) => import('@/app/api/pharmacist/dispense/[id]/route')
        .then((m) => m.POST(post('/x', body), { params: Promise.resolve({ id: '1' }) }));
    it.each([
        [{}, /item_id/],
        [{ item_id: 1, action: 'STEAL' }, /Unknown action/],
        [{ item_id: 1, quantity_to_dispense: 0 }, /positive whole number/],
        [{ item_id: 1, quantity_to_dispense: 1.5 }, /positive whole number/],
        [{ item_id: 1, action: 'REJECT', reason: 'because' }, /rejection reason/],
    ])('rejects %j', async (body, message) => {
        await as('PHARMACIST', PHARMACIST);
        const res = await dispense(body);
        expect(res.status).toBe(400);
        expect((await res.json()).message).toMatch(message);
    });
});

describe('change password validation', () => {
    const change = (body: unknown) => import('@/app/api/auth/change-password/route').then((m) => m.POST(post('/x', body)));
    it.each([
        [{}, /Missing required fields/],
        [{ currentPassword: 'old-pass' }, /Missing required fields/],
        [{ currentPassword: 'old-pass', newPassword: 'abc' }, /at least 6/],
        [{ currentPassword: 'same-pass', newPassword: 'same-pass' }, /different/],
        [{ currentPassword: 'old-pass', newPassword: 'x'.repeat(80) }, /too long/],
    ])('rejects %j', async (body, message) => {
        await as('PATIENT', ALICE);
        const res = await change(body);
        expect(res.status).toBe(400);
        expect((await res.json()).message).toMatch(message);
    });
});
