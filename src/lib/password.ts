import { z } from 'zod';

export const PASSWORD_MIN = 8;

// Passwords that are tried first by anyone guessing. Not a full list: a floor, so the obvious ones are refused.
const COMMON = new Set([
    'password', 'password1', 'password12', 'password123', 'password1234', 'passw0rd', 'p@ssw0rd', 'p@ssword', '12345678', '123456789', '1234567890',
    '11111111', '00000000', 'qwerty123', 'qwertyuiop', 'qwerty12', 'iloveyou', 'admin123', 'administrator', 'welcome1', 'welcome123', 'letmein1',
    'letmein123', 'abc12345', 'abcd1234', 'changeme', 'changeme123', 'sethro123', 'sethromedical', 'medical123', 'doctor123', 'patient123',
]);

/**
 * Why a password is not acceptable, or null when it is. `hints` are things the password must not contain, such as the
 * person's email address (an address' name before the @ is the first thing guessed).
 */
export function passwordProblem(password: string, hints: (string | null | undefined)[] = []): string | null {
    if (password.length < PASSWORD_MIN) return `The password must be at least ${PASSWORD_MIN} characters`;
    // bcrypt only uses the first 72 bytes, so longer passwords would silently be truncated
    if (Buffer.byteLength(password) > 72) return 'Password is too long (72 bytes maximum)';
    const lower = password.toLowerCase();
    if (COMMON.has(lower)) return 'That password is too common. Choose something harder to guess.';
    if (/^(.)\1+$/.test(password)) return 'The password cannot be one character repeated';
    for (const hint of hints) {
        const local = (hint ?? '').toLowerCase().split('@')[0];
        // the whole name and each word of it (jane.doe -> jane, doe)
        const parts = [local, ...local.split(/[^a-z0-9]+/)];
        if (parts.some((part) => part.length >= 4 && lower.includes(part))) return 'The password should not contain your name or email address';
    }
    return null;
}

/** A zod field for a new password. */
export const passwordField = () => z.string().superRefine((value, ctx) => {
    const problem = passwordProblem(value);
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
});
