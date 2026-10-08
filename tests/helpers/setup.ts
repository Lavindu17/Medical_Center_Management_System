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
