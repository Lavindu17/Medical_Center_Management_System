import { vi } from 'vitest';
import { currentToken, setCookies } from '../helpers/state';

// Hard stop: never let an integration test reach the application database.
if (!/_test$/.test(process.env.MYSQL_DATABASE ?? '')) {
    throw new Error(`Integration tests must run against a *_test database, got "${process.env.MYSQL_DATABASE}"`);
}

vi.mock('next/headers', () => ({
    cookies: async () => ({
        get: (name: string) => (name === 'token' && currentToken() ? { name, value: currentToken()! } : undefined),
        set: (arg: any, value?: string, options?: Record<string, unknown>) => {
            const { name, value: v, ...rest } = typeof arg === 'string' ? { name: arg, value, ...options } : arg;
            setCookies.push({ name, value: v, options: rest });
        },
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
