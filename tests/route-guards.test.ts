/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { RESOURCE_KEYS } from '@/lib/access/registry';

// Every API route must say who may use it, and staff routes must do it through the configurable permissions, never a
// hard-wired role. This reads the route sources, so a new route that forgets its guard fails here.
const sources = import.meta.glob('../src/app/api/**/route.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const rel = (p: string) => p.replace('../src/app/api/', '').replace('/route.ts', '');

const PUBLIC = [
    'auth/login', 'auth/register', 'auth/forgot', 'auth/reset', 'auth/verify', 'auth/verify-reset-code', 'auth/logout',
    'auth/resend-verification', 'auth/session', 'auth/change-password', 'auth/switch-account',
    'doctors', 'doctors/availability', 'appointments/availability',
];

describe('every route is guarded', () => {
    for (const [file, text] of Object.entries(sources)) {
        const r = rel(file);
        if (PUBLIC.includes(r)) continue;
        it(`/api/${r}`, () => {
            const guarded = /requirePermission\(|requireAccess\(|requireStaff\(|requireStaffMember\(|requireRole\(\s*'PATIENT'\s*\)|requireRole\(\s*\)|requireRole\(\.\.\.ALL_ROLES\)/.test(text);
            expect(guarded, 'no guard found').toBe(true);
        });
    }
});

describe('staff routes are not tied to a fixed role', () => {
    for (const [file, text] of Object.entries(sources)) {
        it(`/api/${rel(file)}`, () => {
            const fixed = [...text.matchAll(/requireRole\(([^)]*)\)/g)].map((m) => m[1].trim()).filter((args) => args !== '' && args !== "'PATIENT'" && args !== '...ALL_ROLES' && !args.startsWith('...roles'));
            expect(fixed, `still checks a fixed role: ${fixed.join(' | ')}`).toEqual([]);
        });
    }
});

describe('routes only name screens that exist', () => {
    const keys = new Set<string>(RESOURCE_KEYS);
    for (const [file, text] of Object.entries(sources)) {
        for (const m of text.matchAll(/(?:requirePermission\(\s*|\[\s*)'([a-z]+(?:\.[a-z]+)?)'\s*,\s*'(view|add|change|approve)'/g)) {
            it(`/api/${rel(file)}: ${m[1]}`, () => expect(keys.has(m[1]), `${m[1]} is not in the catalogue`).toBe(true));
        }
    }
});
