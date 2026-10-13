/// <reference types="vite/client" />
import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { pool } from '@/lib/db';
import { state } from '../helpers/state';
import { tokenFor, Role } from '../helpers/auth';

// Throw malformed input at every route as every role. A 500 means an unhandled case: it should be a 4xx with a message.

afterAll(async () => { await pool.end(); });
beforeEach(() => { state.token = null; });

const modules = import.meta.glob('../../src/app/api/**/route.ts');
const rel = (p: string) => p.replace('../../src/app/api/', '').replace('/route.ts', '');
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const ROLES: [Role, number][] = [['ADMIN', 1], ['DOCTOR', 2], ['PATIENT', 4], ['PHARMACIST', 6], ['LAB_ASSISTANT', 7], ['RECEPTIONIST', 8]];

const BODIES: (unknown | undefined)[] = [
    undefined, {}, [], null, 'text', 42,
    { id: 'abc', patientId: 'x', doctorId: -1, appointmentId: 1e12, status: {}, name: ['a'], email: 5, date: 'not-a-date', quantity: -5, price: 'NaN' },
    { id: 999999, appointmentId: 999999, itemId: 999999, userId: 999999, medicine_id: 999999, request_id: 999999, status: 'COMPLETED', date: '2026-02-30', time: '25:61' },
    { name: 'x'.repeat(5000), reason: 'y'.repeat(5000), notes: 'z'.repeat(20000), email: 'a@b.co' },
    { __proto__: { admin: true }, constructor: { prototype: 1 }, items: [null, 1, 'x', {}], prescription: 'no', labRequestIds: 'no', vitals: 'no', schedules: 'no' },
];
const QUERIES = ['', '?id=abc', '?id=-1&patientId=abc&userId=0&doctorId=%27%20OR%201=1', '?date=nope&from=x&to=y&month=13&year=abc&limit=-5&cursor=zzz&q=%25%5C_', '?status=%00&type=%FF&period=%3Cscript%3E&search=' + 'a'.repeat(3000)];

const failures = new Map<string, Set<string>>();

async function hit(path: string, method: string, role: Role, id: number, body: unknown, query: string) {
    const mod: any = await modules[path]();
    const handler = mod[method];
    if (!handler) return;
    const url = 'http://localhost/api/' + rel(path).replace(/\[(\w+)\]/g, '1') + query;
    const init: RequestInit = { method };
    if (method !== 'GET' && body !== undefined) {
        init.body = typeof body === 'string' && body === 'text' ? '{not json' : JSON.stringify(body);
        init.headers = { 'content-type': 'application/json' };
    }
    state.token = await tokenFor(role, id);
    let status: number;
    try {
        const res: Response = await handler(new Request(url, init), { params: Promise.resolve({ id: '1' }) });
        status = res.status;
    } catch (err: any) {
        status = 599;
        const key = `${method} /api/${rel(path)}`;
        (failures.get(key) ?? failures.set(key, new Set()).get(key)!).add(`THROW as ${role}: ${String(err?.message).slice(0, 90)}`);
        return;
    }
    if (status >= 500) {
        const key = `${method} /api/${rel(path)}`;
        (failures.get(key) ?? failures.set(key, new Set()).get(key)!).add(`${status} as ${role} body=${JSON.stringify(body)?.slice(0, 60)} q=${query.slice(0, 30)}`);
    }
}

describe('malformed input never causes a server error', () => {
    it('fuzz', async () => {
        const skip = ['auth/login', 'auth/register', 'auth/forgot', 'auth/resend-verification', 'auth/logout'];   // rate limited or send email
        for (const path of Object.keys(modules).sort()) {
            if (skip.includes(rel(path))) continue;
            for (const method of METHODS) {
                for (const [role, id] of ROLES) {
                    for (const body of BODIES) {
                        for (const q of QUERIES.slice(0, method === 'GET' || method === 'DELETE' ? QUERIES.length : 2)) {
                            await hit(path, method, role, id, body, q);
                            if (method === 'GET' || method === 'DELETE') break;
                        }
                        if (method === 'GET' || method === 'DELETE') break;
                    }
                    if (method === 'GET' || method === 'DELETE') {
                        for (const q of QUERIES) await hit(path, method, role, id, undefined, q);
                    }
                }
            }
        }
        const report = [...failures].map(([k, v]) => `${k}\n   ${[...v].slice(0, 4).join('\n   ')}`).join('\n');
        console.log('ROUTES THAT RETURN 5xx ON BAD INPUT (' + failures.size + ' routes)\n' + report);
        expect(failures.size).toBe(0);
    }, 600000);
});
