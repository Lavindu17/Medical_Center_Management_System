import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { vi } from 'vitest';
import { pool, query } from '@/lib/db';
import { EmailService } from '@/services/email.service';
import { AuthService } from '@/services/auth.service';
import { state, setCookies } from '../helpers/state';
import { tokenFor } from '../helpers/auth';
import { post, one, rows } from './helpers';

// Plan section 2 and 1.3: registration, verification, login, reset, change-password and session revocation.

afterAll(async () => { await pool.end(); });

let counter = 0;
const uniqueEmail = (label = 'user') => `${label}.${Date.now()}.${counter++}@auth-test.local`;
const PASSWORD = 'Correct-Horse-1';

const mails = {
    verification: () => vi.mocked(EmailService.sendVerificationEmail).mock.calls,
    reset: () => vi.mocked(EmailService.sendPasswordResetEmail).mock.calls,
};
const lastCode = (kind: 'verification' | 'reset') => mails[kind]().at(-1)![1] as string;

beforeEach(async () => {
    await query('DELETE FROM rate_limits');
    state.token = null;
    setCookies.length = 0;
    vi.mocked(EmailService.sendVerificationEmail).mockReset().mockResolvedValue({} as any);
    vi.mocked(EmailService.sendPasswordResetEmail).mockReset().mockResolvedValue({} as any);
});

async function call(route: string, body: unknown, method = 'POST') {
    const mod: any = await import(`@/app/api/auth/${route}/route`);
    return mod[method](post(`/api/auth/${route}`, body, method));
}

async function register(email = uniqueEmail(), overrides: Record<string, unknown> = {}) {
    const res = await call('register', { firstName: 'Test', lastName: 'Person', email, password: PASSWORD, dob: '1990-01-01', gender: 'FEMALE', ...overrides });
    return { res, email };
}

async function verifiedUser() {
    const { email } = await register();
    expect((await call('verify', { email, code: lastCode('verification') })).status).toBe(200);
    return email;
}

const login = (email: string, password = PASSWORD) => call('login', { email, password });
const userRow = (email: string) => one(`SELECT * FROM users WHERE email = ?`, [email]);

describe('registration', () => {
    it('creates an unverified patient and emails a code', async () => {
        const { res, email } = await register();
        expect(res.status).toBe(201);
        expect((await res.json()).emailSent).toBe(true);
        const user = await userRow(email);
        expect(user).toMatchObject({ role: 'PATIENT', is_verified: 0 });
        expect(user.password_hash).not.toContain(PASSWORD);
        expect(await one(`SELECT user_id FROM patients WHERE user_id = ?`, [user.id])).toBeTruthy();
        expect(lastCode('verification')).toMatch(/^[0-9A-F]{6}$/);
    });

    it('rejects duplicates, including a differently-cased address', async () => {
        const { email } = await register();
        expect((await register(email)).res.status).toBe(409);
        expect((await register(email.toUpperCase())).res.status).toBe(409);
    });

    it.each([
        ['future date of birth', { dob: '2999-01-01' }],
        ['impossible date', { dob: '1990-02-30' }],
        ['not a date', { dob: 'abc' }],
        ['too-old date', { dob: '1800-01-01' }],
        ['5-character password', { password: '12345' }],
        ['73-byte password', { password: 'a'.repeat(73) }],
        ['1-character first name', { firstName: 'A' }],
        ['bad gender', { gender: 'ROBOT' }],
        ['bad email', { email: 'not-an-email' }],
    ])('rejects %s', async (_label, override) => {
        expect((await register(uniqueEmail(), override as any)).res.status).toBe(400);
    });

    it('is not stranded when the verification email cannot be sent: the account exists and a resend works', async () => {
        vi.mocked(EmailService.sendVerificationEmail).mockRejectedValueOnce(new Error('SMTP down'));
        const { res, email } = await register();
        expect(res.status).toBe(201);
        expect((await res.json()).emailSent).toBe(false);
        expect(await userRow(email)).toBeTruthy();

        expect((await call('resend-verification', { email })).status).toBe(200);
        expect((await call('verify', { email, code: lastCode('verification') })).status).toBe(200);
        expect((await login(email)).status).toBe(200);
    });

    it('simultaneous sign-ups with one address create one account and no server error', async () => {
        const email = uniqueEmail();
        const results = await Promise.all([register(email), register(email), register(email)]);
        const codes = results.map((r) => r.res.status).sort();
        expect(codes.filter((c) => c === 201)).toHaveLength(1);
        expect(codes.filter((c) => c >= 500)).toHaveLength(0);
        expect(await rows(`SELECT id FROM users WHERE email = ?`, [email])).toHaveLength(1);
    });
});

describe('email verification', () => {
    it('accepts the code regardless of case and surrounding spaces, then logs in', async () => {
        const { email } = await register();
        const code = lastCode('verification');
        expect((await call('verify', { email, code: `  ${code.toLowerCase()} ` })).status).toBe(200);
        expect((await userRow(email)).is_verified).toBe(1);
    });

    it('a code works once only', async () => {
        const { email } = await register();
        const code = lastCode('verification');
        expect((await call('verify', { email, code })).status).toBe(200);
        expect((await call('verify', { email, code })).status).toBe(400);
    });

    it('does not reveal whether an address has an account', async () => {
        const { email } = await register();
        const wrong = await call('verify', { email, code: 'ZZZZZZ' });
        const unknown = await call('verify', { email: uniqueEmail('ghost'), code: 'ZZZZZZ' });
        expect(wrong.status).toBe(unknown.status);
        expect((await wrong.json()).message).toBe((await unknown.json()).message);
    });

    it('destroys the code after 5 wrong guesses, so even the right code then fails', async () => {
        const { email } = await register();
        const code = lastCode('verification');
        let last: any;
        for (let i = 0; i < 5; i++) last = await (await call('verify', { email, code: `BAD${i}00` })).json();
        expect(last.message).toMatch(/too many/i);
        expect((await call('verify', { email, code })).status).toBe(400);
        expect((await userRow(email)).is_verified).toBe(0);
        // ...but a freshly issued code still works
        await call('resend-verification', { email });
        expect((await call('verify', { email, code: lastCode('verification') })).status).toBe(200);
    });

    it('an expired code is refused and removed', async () => {
        const { email } = await register();
        const code = lastCode('verification');
        await query(`UPDATE auth_codes SET expires_at = NOW() - INTERVAL 1 MINUTE WHERE user_id = (SELECT id FROM users WHERE email = ?)`, [email]);
        expect((await call('verify', { email, code })).status).toBe(400);
        expect(await rows(`SELECT id FROM auth_codes WHERE user_id = (SELECT id FROM users WHERE email = ?)`, [email])).toHaveLength(0);
    });

    it('a newer code supersedes the previous one', async () => {
        const { email } = await register();
        const first = lastCode('verification');
        await query('DELETE FROM rate_limits');
        await call('resend-verification', { email });
        const second = lastCode('verification');
        expect(second).not.toBe(first);
        expect((await call('verify', { email, code: first })).status).toBe(400);
        expect((await call('verify', { email, code: second })).status).toBe(200);
    });
});

describe('resend verification', () => {
    it('answers identically for unknown, verified and unverified addresses', async () => {
        const unverified = (await register()).email;
        const verified = await verifiedUser();
        await query('DELETE FROM rate_limits');
        const bodies = [];
        for (const email of [unverified, verified, uniqueEmail('ghost')]) {
            await query('DELETE FROM rate_limits');
            const res = await call('resend-verification', { email });
            expect(res.status).toBe(200);
            bodies.push((await res.json()).message);
        }
        expect(new Set(bodies).size).toBe(1);
    });

    it('sends nothing to verified or unknown addresses', async () => {
        const verified = await verifiedUser();
        const before = mails.verification().length;
        await call('resend-verification', { email: verified });
        await query('DELETE FROM rate_limits');
        await call('resend-verification', { email: uniqueEmail('ghost') });
        expect(mails.verification().length).toBe(before);
    });

    it('is limited to one code a minute', async () => {
        const { email } = await register();
        expect((await call('resend-verification', { email })).status).toBe(200);
        expect((await call('resend-verification', { email })).status).toBe(429);
    });
});

describe('login', () => {
    it('signs in a verified user without exposing secrets, and sets a locked-down cookie', async () => {
        const email = await verifiedUser();
        const res = await login(email);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.user).toMatchObject({ email, role: 'PATIENT' });
        expect(JSON.stringify(body)).not.toMatch(/password_hash|"token"/);
        const cookie = setCookies.at(-1)!;
        expect(cookie.name).toBe('token');
        expect(cookie.options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
        expect(await AuthService.verifyToken(cookie.value)).toMatchObject({ email, role: 'PATIENT' });
    });

    it('gives the same answer for a wrong password and an unknown address', async () => {
        const email = await verifiedUser();
        const wrong = await login(email, 'nope-nope');
        const ghost = await login(uniqueEmail('ghost'));
        expect(wrong.status).toBe(401);
        expect(ghost.status).toBe(401);
        expect((await wrong.json()).message).toBe((await ghost.json()).message);
    });

    it('only tells someone who knows the password that the account is unverified', async () => {
        const { email } = await register();
        expect((await login(email, 'wrong-password')).status).toBe(401);
        expect((await login(email)).status).toBe(403);
    });

    it('blocks further guesses after 10 attempts, even with the right password, and recovers on success elsewhere', async () => {
        const email = await verifiedUser();
        for (let i = 0; i < 10; i++) expect((await login(email, 'wrong-' + i)).status).toBe(401);
        expect((await login(email)).status).toBe(429);
        // another account is unaffected
        const other = await verifiedUser();
        expect((await login(other)).status).toBe(200);
    });

    it('a successful login resets the failure counter', async () => {
        const email = await verifiedUser();
        for (let i = 0; i < 8; i++) await login(email, 'wrong-' + i);
        expect((await login(email)).status).toBe(200);
        for (let i = 0; i < 8; i++) expect((await login(email, 'wrong-' + i)).status).toBe(401);
    });

    it.each([{}, { email: 'a@b.co' }, { password: 'x' }, { email: 'nope', password: 'x' }])('rejects malformed body %j', async (body) => {
        expect((await call('login', body)).status).toBe(400);
    });
});

describe('forgot / reset password', () => {
    it('answers the same for unknown and known addresses and never errors when mail fails', async () => {
        const email = await verifiedUser();
        const known = await call('forgot', { email });
        const ghost = await call('forgot', { email: uniqueEmail('ghost') });
        expect(known.status).toBe(200);
        expect((await known.json()).message).toBe((await ghost.json()).message);
        vi.mocked(EmailService.sendPasswordResetEmail).mockRejectedValueOnce(new Error('SMTP down'));
        await query('DELETE FROM rate_limits');
        expect((await call('forgot', { email })).status).toBe(200);
    });

    it('limits reset emails to 3 an hour per address', async () => {
        const email = await verifiedUser();
        for (let i = 0; i < 3; i++) expect((await call('forgot', { email })).status).toBe(200);
        expect((await call('forgot', { email })).status).toBe(429);
    });

    it('full flow: code -> check -> new password; old password stops working', async () => {
        const email = await verifiedUser();
        await call('forgot', { email });
        const code = lastCode('reset');
        expect((await call('verify-reset-code', { email, code })).status).toBe(200);
        const res = await call('reset', { email, code, newPassword: 'Brand-New-Pass-9' });
        expect(res.status).toBe(200);
        expect((await login(email)).status).toBe(401);
        expect((await login(email, 'Brand-New-Pass-9')).status).toBe(200);
        expect((await call('reset', { email, code, newPassword: 'Another-Pass-1' })).status).toBe(400); // single use
    });

    it('a reset proves control of the address: an unverified account becomes verified', async () => {
        const { email } = await register();
        await call('forgot', { email });
        await call('reset', { email, code: lastCode('reset'), newPassword: 'Brand-New-Pass-9' });
        expect((await userRow(email)).is_verified).toBe(1);
        expect((await login(email, 'Brand-New-Pass-9')).status).toBe(200);
    });

    it('a reset signs out sessions that were issued before it', async () => {
        const email = await verifiedUser();
        const user = await userRow(email);
        const oldSession = await tokenFor('PATIENT', user.id, undefined, Math.floor(Date.now() / 1000) - 120);
        expect(await AuthService.verifyToken(oldSession)).toBeTruthy();
        await call('forgot', { email });
        await call('reset', { email, code: lastCode('reset'), newPassword: 'Brand-New-Pass-9' });
        expect(await AuthService.verifyToken(oldSession)).toBeNull();
        expect(await AuthService.verifyToken(await tokenFor('PATIENT', user.id))).toBeTruthy();
    });

    it('guessing the reset code is cut off after 5 tries', async () => {
        const email = await verifiedUser();
        await call('forgot', { email });
        const code = lastCode('reset');
        for (let i = 0; i < 5; i++) await call('verify-reset-code', { email, code: `BAD${i}00` });
        expect((await call('verify-reset-code', { email, code })).status).toBe(400);
        expect((await call('reset', { email, code, newPassword: 'Brand-New-Pass-9' })).status).toBe(400);
        expect((await login(email)).status).toBe(200); // password unchanged
    });

    it('rejects weak, over-long and missing new passwords', async () => {
        const email = await verifiedUser();
        await call('forgot', { email });
        const code = lastCode('reset');
        for (const newPassword of ['12345', 'a'.repeat(73), '']) {
            expect((await call('reset', { email, code, newPassword })).status, newPassword.slice(0, 8)).toBe(400);
        }
        expect((await call('reset', { email, code, newPassword: 'Good-New-Pass-1' })).status).toBe(200); // code still alive
    });
});

describe('change password', () => {
    async function signedIn() {
        const email = await verifiedUser();
        const user = await userRow(email);
        state.token = await tokenFor('PATIENT', user.id);
        return { email, user };
    }

    it('requires a valid session', async () => {
        state.token = null;
        expect((await call('change-password', { currentPassword: PASSWORD, newPassword: 'New-Pass-123' })).status).toBe(401);
    });

    it('changes the password, keeps this device signed in and signs out older sessions', async () => {
        const { email, user } = await signedIn();
        const stolen = await tokenFor('PATIENT', user.id, undefined, Math.floor(Date.now() / 1000) - 120);
        const res = await call('change-password', { currentPassword: PASSWORD, newPassword: 'New-Pass-123' });
        expect(res.status).toBe(200);
        expect((await login(email)).status).toBe(401);
        expect((await login(email, 'New-Pass-123')).status).toBe(200);
        expect(await AuthService.verifyToken(stolen)).toBeNull();
        const fresh = setCookies.filter((c) => c.name === 'token')[0];
        expect(await AuthService.verifyToken(fresh.value)).toBeTruthy();
    });

    it.each([
        ['wrong current password', { currentPassword: 'wrong-one', newPassword: 'New-Pass-123' }],
        ['same password', { currentPassword: PASSWORD, newPassword: PASSWORD }],
        ['too short', { currentPassword: PASSWORD, newPassword: '123' }],
        ['too long', { currentPassword: PASSWORD, newPassword: 'a'.repeat(80) }],
        ['missing fields', { currentPassword: PASSWORD }],
    ])('refuses %s', async (_label, body) => {
        const { email } = await signedIn();
        expect((await call('change-password', body)).status).toBe(400);
        expect((await login(email)).status).toBe(200); // unchanged
    });

    it('stops guessing of the current password after 5 attempts', async () => {
        await signedIn();
        for (let i = 0; i < 5; i++) expect((await call('change-password', { currentPassword: 'guess' + i, newPassword: 'New-Pass-123' })).status).toBe(400);
        expect((await call('change-password', { currentPassword: PASSWORD, newPassword: 'New-Pass-123' })).status).toBe(429);
    });
});

describe('session revocation', () => {
    it('a token for a deleted account stops working at once', async () => {
        const email = await verifiedUser();
        const user = await userRow(email);
        const token = await tokenFor('PATIENT', user.id);
        expect(await AuthService.verifyToken(token)).toBeTruthy();
        await query('DELETE FROM users WHERE id = ?', [user.id]);
        expect(await AuthService.verifyToken(token)).toBeNull();
    });

    it('a token carrying a role the account no longer has is rejected', async () => {
        const email = await verifiedUser();
        const user = await userRow(email);
        expect(await AuthService.verifyToken(await tokenFor('ADMIN', user.id))).toBeNull(); // forged/stale elevated role
        await query(`UPDATE users SET role = 'RECEPTIONIST' WHERE id = ?`, [user.id]);
        expect(await AuthService.verifyToken(await tokenFor('PATIENT', user.id))).toBeNull(); // demoted after login
    });

    it('API routes honour revocation, not just the signature', async () => {
        const email = await verifiedUser();
        const user = await userRow(email);
        state.token = await tokenFor('PATIENT', user.id);
        const { GET } = await import('@/app/api/patient/profile/route');
        expect((await GET(new Request('http://x/api/patient/profile'))).status).toBe(200);
        await query('DELETE FROM users WHERE id = ?', [user.id]);
        expect((await GET(new Request('http://x/api/patient/profile'))).status).toBe(401);
    });
});
