import { vi } from 'vitest';
import { state } from './state';

process.env.JWT_SECRET = 'test-secret-for-vitest-only';

// No database in the security matrix: any query that is reached returns nothing.
vi.mock('@/lib/db', () => {
    const conn = {
        execute: vi.fn(async () => [[], []]),
        query: vi.fn(async () => [[], []]),
        beginTransaction: vi.fn(async () => {}),
        commit: vi.fn(async () => {}),
        rollback: vi.fn(async () => {}),
        release: vi.fn(),
    };
    return {
        query: vi.fn(async () => []),
        pool: { execute: vi.fn(async () => [[], []]), getConnection: vi.fn(async () => conn), query: vi.fn(async () => [[], []]) },
    };
});

// Permissions: by default every role has what a freshly seeded site gives it (the starting profiles), so the route tests can
// exercise their own behaviour without a database. Tests of the lookup itself set state.realAccess to use the real one.
vi.mock('@/lib/access/resolve', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/access/resolve')>();
    const defaults = await import('@/lib/access/defaults');
    const registry = await import('@/lib/access/registry');
    return {
        ...actual,
        grantsFor: async (user: { id: number; role: string }) => {
            if (state.realAccess) return actual.grantsFor(user);
            if (!defaults.isStaffRole(user.role)) return {};
            const out: Record<string, unknown> = {};
            for (const key of registry.RESOURCE_KEYS) {
                const g = defaults.normalise(key, defaults.ROLE_TEMPLATES[user.role][key] ?? {});
                if (Object.keys(g).length > 0) out[key] = g;
            }
            if (user.role === 'ADMIN') out[defaults.ALWAYS_ADMIN] = { view: true, change: true };
            return out;
        },
    };
});

vi.mock('@/lib/session-check', () => ({ isSessionCurrent: vi.fn(async () => true) }));

vi.mock('next/headers', () => ({
    cookies: async () => ({
        get: (name: string) => (name === 'token' && state.token ? { name, value: state.token } : undefined),
        set: () => {},
        delete: () => {},
    }),
}));

vi.mock('@/services/email.service', () => ({
    EmailService: {
        sendEmail: vi.fn(async () => ({})),
        sendVerificationEmail: vi.fn(async () => ({})),
        sendPasswordResetEmail: vi.fn(async () => ({})),
    },
}));
