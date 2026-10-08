import { vi } from 'vitest';
import { currentToken } from '../helpers/state';

// Hard stop: never let an integration test reach the application database.
if (!/_test$/.test(process.env.MYSQL_DATABASE ?? '')) {
    throw new Error(`Integration tests must run against a *_test database, got "${process.env.MYSQL_DATABASE}"`);
}

vi.mock('next/headers', () => ({
    cookies: async () => ({
        get: (name: string) => (name === 'token' && currentToken() ? { name, value: currentToken()! } : undefined),
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
