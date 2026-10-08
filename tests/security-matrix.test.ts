import { describe, it, expect, beforeEach } from 'vitest';
import { state } from './helpers/state';
import { tokenFor, Role } from './helpers/auth';

// Plan section 1.1: every API route must reject anonymous and wrong-role callers.
// Routes are discovered automatically, so new routes are covered without edits here.
const modules = import.meta.glob('../src/app/api/**/route.ts');

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

// Intentionally reachable without a session (confirm each in review).
const PUBLIC = [
    'auth/login', 'auth/register', 'auth/forgot', 'auth/reset', 'auth/verify',
    'auth/verify-reset-code', 'auth/logout',
    'doctors', 'doctors/availability', 'appointments/availability',
];

// Role-prefixed routes: any other role must be refused.
const ROLE_PREFIX: Record<string, Role> = {
    admin: 'ADMIN', doctor: 'DOCTOR', pharmacist: 'PHARMACIST',
    'lab-assistant': 'LAB_ASSISTANT', receptionist: 'RECEPTIONIST', patient: 'PATIENT',
    users: 'ADMIN',
};

const rel = (p: string) => p.replace('../src/app/api/', '').replace('/route.ts', '');
const isPublic = (r: string) => PUBLIC.includes(r);

async function call(path: string, method: string) {
    const mod: any = await modules[path]();
    const handler = mod[method];
    if (!handler) return null;
    const url = 'http://localhost/api/' + rel(path).replace(/\[(\w+)\]/g, '1') + '?id=1&patientId=1&userId=1&doctorId=1&type=prescriptions';
    const init: RequestInit = { method };
    if (method !== 'GET') {
        init.body = JSON.stringify({});
        init.headers = { 'content-type': 'application/json' };
    }
    const params = Promise.resolve({ id: '1' });
    try {
        const res: Response = await handler(new Request(url, init), { params });
        return res.status;
    } catch {
        return 500;
    }
}

const cases = Object.keys(modules).sort();

describe('anonymous callers are rejected', () => {
    beforeEach(() => { state.token = null; });
    for (const path of cases) {
        const r = rel(path);
        if (isPublic(r)) continue;
        for (const m of METHODS) {
            it(`${m} /api/${r}`, async () => {
                const status = await call(path, m);
                if (status === null) return;
                expect([401, 403], `got ${status}`).toContain(status);
            });
        }
    }
});

describe('wrong-role callers are rejected', () => {
    for (const path of cases) {
        const r = rel(path);
        const owner = ROLE_PREFIX[r.split('/')[0]];
        if (!owner || isPublic(r)) continue;
        const intruder: Role = owner === 'PATIENT' ? 'DOCTOR' : 'PATIENT';
        for (const m of METHODS) {
            it(`${m} /api/${r} as ${intruder}`, async () => {
                state.token = await tokenFor(intruder);
                const status = await call(path, m);
                if (status === null) return;
                expect([401, 403], `got ${status}`).toContain(status);
            });
        }
    }
});

describe('forged / tampered tokens are rejected', () => {
    const sample = cases.filter((p) => !isPublic(rel(p))).slice(0, 80);
    for (const path of sample) {
        it(`token signed with fallback secret: /api/${rel(path)}`, async () => {
            state.token = await tokenFor('ADMIN', 1, 'fallback-secret-key-change-me');
            for (const m of METHODS) {
                const status = await call(path, m);
                if (status === null) continue;
                expect([401, 403], `${m} got ${status}`).toContain(status);
            }
        });
    }
});
