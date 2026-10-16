/// <reference types="vite/client" />
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { query } from '@/lib/db';
import { state } from './helpers/state';
import { tokenFor } from './helpers/auth';
import { levelsOf, isResource, type Level, type ResourceKey } from '@/lib/access/registry';

// The contract of every guarded route, checked against what the code actually declares: a person who holds exactly the declared
// permission gets past the guard, a person who holds nothing is refused, and holding only a lower level is not enough.
// (Routes are read from their source, so a new route is covered without editing this file.)
const sources = import.meta.glob('../src/app/api/**/route.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const modules = import.meta.glob('../src/app/api/**/route.ts');
const rel = (p: string) => p.replace('../src/app/api/', '').replace('/route.ts', '');

interface Declared { method: string; patient: boolean; rules: [ResourceKey, Level][] }

function declarations(text: string): Declared[] {
    const handlers = [...text.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => ({ method: m[1], at: m.index! }));
    return handlers.flatMap((h, i) => {
        const segment = text.slice(h.at, handlers[i + 1]?.at ?? text.length);
        const guard = /require(Permission|Access)\(([^)]*(?:\[[^\]]*\][^)]*)*)\)/.exec(segment);
        if (!guard) return [];
        const args = guard[2];
        const rules: [ResourceKey, Level][] = guard[1] === 'Permission'
            ? [[...args.matchAll(/'([^']+)'/g)].slice(0, 2).map((m) => m[1]) as [ResourceKey, Level]]
            : [...args.matchAll(/\['([\w.]+)',\s*'(\w+)'\]/g)].map((m) => [m[1], m[2]] as [ResourceKey, Level]);
        return [{ method: h.method, patient: /'PATIENT'/.test(args), rules }];
    });
}

const rows = (profileId: number, resource: string, levels: string[]) => ({
    profile_id: profileId, system_role: null, resource,
    can_view: +levels.includes('view'), can_add: +levels.includes('add'), can_change: +levels.includes('change'), can_approve: +levels.includes('approve'),
});

/** Pretend database: the person has exactly these ticks (given through a profile), and the role has nothing stored. */
function givenOnly(ticks: { resource: string; levels: string[] }[]) {
    vi.mocked(query).mockReset().mockImplementation((async (sql: string) =>
        /access_profiles/.test(sql) ? ticks.map((t) => rows(9, t.resource, t.levels)) : []) as any);
}

async function call(file: string, method: string): Promise<number> {
    const mod: any = await modules[file]();
    // No ids in the query string: a route's own "this is not yours" answers would look like a refused guard
    const url = 'http://localhost/api/' + rel(file).replace(/\[(\w+)\]/g, '1');
    const init: RequestInit = { method };
    if (method !== 'GET') { init.body = JSON.stringify({}); init.headers = { 'content-type': 'application/json' }; }
    try {
        const res: Response = await mod[method](new Request(url, init), { params: Promise.resolve({ id: '1', role: 'DOCTOR', key: 'billing' }) });
        return res.status;
    } catch {
        return 500;     // got past the guard and then failed on the empty pretend database: that is "not refused"
    }
}

beforeAll(() => { state.realAccess = true; });
afterAll(() => { state.realAccess = false; });
beforeEach(() => { state.token = null; });

const cases = Object.entries(sources).flatMap(([file, text]) => declarations(text).map((d) => ({ file, route: rel(file), ...d })));

describe('the declarations are found', () => {
    it('reads a guard for a large number of handlers, and every named screen and level exists', () => {
        expect(cases.length).toBeGreaterThan(100);
        for (const c of cases) for (const [r, l] of c.rules) {
            expect(isResource(r), `${c.route} ${c.method}: ${r}`).toBe(true);
            expect(levelsOf(r), `${c.route} ${c.method}: ${r} does not offer ${l}`).toContain(l);
        }
    });
});

describe('holding exactly the declared permission is enough, holding less is not', () => {
    for (const c of cases) {
        for (const [resource, level] of c.rules) {
            it(`${c.method} /api/${c.route} needs ${resource}:${level}`, async () => {
                state.token = await tokenFor('STAFF', 77);

                givenOnly([{ resource, levels: [level] }]);
                const allowed = await call(c.file, c.method);
                expect([401, 403], `refused although the person holds ${resource}:${level}`).not.toContain(allowed);

                givenOnly([]);
                expect(await call(c.file, c.method), 'allowed with nothing').toBe(403);

                // Only "view" on the same screen: enough for a view rule, not for a higher one, unless another rule lets them in
                if (level !== 'view' && !c.rules.some(([r, l]) => r === resource && l === 'view')) {
                    givenOnly([{ resource, levels: ['view'] }]);
                    expect(await call(c.file, c.method), `${resource}:view alone must not do ${level}`).toBe(403);
                }
            });
        }
        if (c.patient) {
            it(`${c.method} /api/${c.route} lets a patient in (the customer side)`, async () => {
                state.token = await tokenFor('PATIENT', 4);
                givenOnly([]);
                expect([401, 403]).not.toContain(await call(c.file, c.method));
            });
        } else {
            it(`${c.method} /api/${c.route} keeps patients out, whatever profile is "given" to them`, async () => {
                state.token = await tokenFor('PATIENT', 4);
                givenOnly(c.rules.map(([resource, level]) => ({ resource, levels: [level] })));
                expect(await call(c.file, c.method)).toBe(403);
            });
        }
    }
});

describe('a staff role with nothing stored reaches no guarded route', () => {
    it('every guarded handler refuses a doctor whose role and profiles store nothing', async () => {
        state.token = await tokenFor('DOCTOR', 2);
        givenOnly([]);
        for (const c of cases) expect(await call(c.file, c.method), `${c.method} /api/${c.route}`).toBe(403);
    });
});
