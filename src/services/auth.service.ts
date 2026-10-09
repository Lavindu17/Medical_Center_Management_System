import { User } from '@/types';
import { pool, query } from '@/lib/db';
import bcrypt from 'bcrypt';
import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';
import { EmailService } from './email.service';
import { isSessionCurrent } from '@/lib/session-check';
import { audit } from '@/lib/audit';

const SALT_ROUNDS = 10;
const CODE_TTL_MS = 15 * 60 * 1000;
/** Wrong guesses allowed per emailed code before it is destroyed. */
export const MAX_CODE_ATTEMPTS = 5;

// No fallback: an unset secret must fail closed rather than allow forgeable tokens
function getSecretKey(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not configured');
    return new TextEncoder().encode(secret);
}

type CodeType = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';
type CodeResult = { success: boolean; message: string };

// The same text for "no such user", "no code", "expired" and "wrong" so responses cannot be used to probe accounts.
const INVALID_CODE = 'Invalid or expired code';
const TOO_MANY = 'Too many incorrect attempts. Please request a new code.';

export class AuthService {
    static async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, SALT_ROUNDS);
    }

    static async comparePassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    /** Burns the same time as a real comparison so "unknown email" is not distinguishable by latency. */
    static async fakeCompare(password: string): Promise<void> {
        await bcrypt.compare(password, '$2b$10$xQtcNhKLC5JMmuvx0ail/uJDuUGU5UBKr5wMho7B/CCrGeN5ZVKU2');
    }

    /**
     * `actor` is set when a family member switches into another account: the token then says who the real person is,
     * so the audit trail can name them instead of only the account they are acting as.
     */
    static async generateToken(user: User, actor?: { id: number; name: string }): Promise<string> {
        return new SignJWT({
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
            ...(actor ? { actorId: actor.id, actorName: actor.name } : {}),
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('1d')
            .sign(getSecretKey());
    }

    /** Verifies the signature and expiry, then that the account still exists with the same role and was not signed out by a password change. */
    static async verifyToken(token: string) {
        try {
            const { payload } = await jwtVerify(token, getSecretKey());
            if (!(await isSessionCurrent(payload))) return null;
            return payload;
        } catch (error) {
            return null;
        }
    }

    static async findUserByEmail(email: string): Promise<User | null> {
        try {
            const users = await query<User[]>('SELECT * FROM users WHERE email = ?', [email]);
            return users.length > 0 ? users[0] : null; // returns RowDataPacket potentially, but we cast
        } catch (error) {
            console.error('Find User Error:', error);
            return null;
        }
    }

    static async getUserByEmailWithPassword(email: string): Promise<any> {
        const [rows]: any = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        return rows.length > 0 ? rows[0] : null;
    }

    // --- OTP Utilities ---

    private static generateOTP(): string {
        // 6 uppercase hex characters (24 bits). Safe because each code survives only MAX_CODE_ATTEMPTS wrong guesses.
        return crypto.randomBytes(3).toString('hex').toUpperCase();
    }

    private static hashOTP(otp: string): string {
        return crypto.createHash('sha256').update(otp).digest('hex');
    }

    private static normalizeCode(code: string): string {
        return String(code).trim().toUpperCase();
    }

    private static sameHash(a: string, b: string): boolean {
        const x = Buffer.from(a);
        const y = Buffer.from(b);
        return x.length === y.length && crypto.timingSafeEqual(x, y);
    }

    private static async issueCode(userId: number, type: CodeType): Promise<string> {
        const code = this.generateOTP();
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            // Replace any earlier code for this purpose (also resets the attempt counter)
            await connection.execute('DELETE FROM auth_codes WHERE user_id = ? AND type = ?', [userId, type]);
            await connection.execute(
                'INSERT INTO auth_codes (user_id, type, code_hash, expires_at, attempts) VALUES (?, ?, ?, ?, 0)',
                [userId, type, this.hashOTP(code), new Date(Date.now() + CODE_TTL_MS)]
            );
            await connection.commit();
        } catch (err) {
            await connection.rollback().catch(() => {});
            throw err;
        } finally {
            connection.release();
        }
        return code;
    }

    /**
     * Checks a submitted code. A wrong guess counts against the stored code, which is destroyed once
     * MAX_CODE_ATTEMPTS is reached; expired codes are destroyed on sight.
     */
    private static async checkCode(userId: number, type: CodeType, submitted: string): Promise<CodeResult & { codeId?: number }> {
        const rows = await query<any[]>('SELECT * FROM auth_codes WHERE user_id = ? AND type = ? ORDER BY id DESC LIMIT 1', [userId, type]);
        const record = rows[0];
        if (!record) return { success: false, message: INVALID_CODE };

        if (new Date() > new Date(record.expires_at)) {
            await query('DELETE FROM auth_codes WHERE id = ?', [record.id]);
            return { success: false, message: INVALID_CODE };
        }
        if (record.attempts >= MAX_CODE_ATTEMPTS) {
            await query('DELETE FROM auth_codes WHERE id = ?', [record.id]);
            return { success: false, message: TOO_MANY };
        }

        if (!this.sameHash(this.hashOTP(this.normalizeCode(submitted)), record.code_hash)) {
            // Increment atomically so parallel guesses cannot dodge the counter
            await query('UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ?', [record.id]);
            if (record.attempts + 1 >= MAX_CODE_ATTEMPTS) {
                await query('DELETE FROM auth_codes WHERE id = ?', [record.id]);
                return { success: false, message: TOO_MANY };
            }
            return { success: false, message: INVALID_CODE };
        }
        return { success: true, message: 'Code is valid', codeId: record.id };
    }

    // --- Verification Flow ---

    static async initiateEmailVerification(userId: number, email: string) {
        const code = await this.issueCode(userId, 'EMAIL_VERIFICATION');
        await EmailService.sendVerificationEmail(email, code); // Send PLAIN code
    }

    static async verifyEmail(email: string, code: string): Promise<CodeResult> {
        const user: any = await this.findUserByEmail(email);
        if (!user || user.is_verified) return { success: false, message: INVALID_CODE };

        const check = await this.checkCode(user.id, 'EMAIL_VERIFICATION', code);
        if (!check.success) return check;

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute('UPDATE users SET is_verified = TRUE WHERE id = ?', [user.id]);
            await connection.execute('DELETE FROM auth_codes WHERE user_id = ? AND type = ?', [user.id, 'EMAIL_VERIFICATION']);
            await connection.commit();
        } catch (err) {
            await connection.rollback().catch(() => {});
            throw err;
        } finally {
            connection.release();
        }

        return { success: true, message: 'Email verified successfully' };
    }

    // --- Forgot Password Flow ---

    static async initiatePasswordReset(email: string) {
        const user: any = await this.findUserByEmail(email);
        if (!user) return;

        const code = await this.issueCode(user.id, 'PASSWORD_RESET');
        await EmailService.sendPasswordResetEmail(email, code);
    }

    static async validateResetCode(email: string, code: string): Promise<CodeResult> {
        const user: any = await this.findUserByEmail(email);
        if (!user) return { success: false, message: INVALID_CODE };

        const check = await this.checkCode(user.id, 'PASSWORD_RESET', code);
        return { success: check.success, message: check.message };
    }

    static async resetPassword(email: string, code: string, newPassword: string): Promise<CodeResult> {
        const user: any = await this.findUserByEmail(email);
        if (!user) return { success: false, message: INVALID_CODE };

        const check = await this.checkCode(user.id, 'PASSWORD_RESET', code);
        if (!check.success) return { success: check.success, message: check.message };

        const hashedPassword = await this.hashPassword(newPassword);

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            // Receiving the emailed code proves control of the address, so the account is verified too.
            // password_changed_at ends every session issued before this moment.
            await connection.execute(
                'UPDATE users SET password_hash = ?, is_verified = TRUE, password_changed_at = NOW() WHERE id = ?',
                [hashedPassword, user.id]);
            await connection.execute('DELETE FROM auth_codes WHERE user_id = ?', [user.id]);
            await connection.commit();
        } catch (err) {
            await connection.rollback().catch(() => {});
            throw err;
        } finally {
            connection.release();
        }

        await audit({ id: user.id, role: user.role, name: user.name }, { action: 'PASSWORD_RESET', entity: 'USER', entityId: user.id });
        return { success: true, message: 'Password reset successfully' };
    }
}
