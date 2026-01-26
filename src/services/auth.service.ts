import { User, Role } from '@/types';
import { pool, query } from '@/lib/db';
import bcrypt from 'bcrypt';
import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';
import { EmailService } from './email.service';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-change-me';
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export class AuthService {
    static async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, SALT_ROUNDS);
    }

    static async comparePassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    static async generateToken(user: User): Promise<string> {
        return new SignJWT({
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('1d')
            .sign(SECRET_KEY);
    }

    static async verifyToken(token: string) {
        try {
            const { payload } = await jwtVerify(token, SECRET_KEY);
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
        // Generate 6 character hex OTP (3 bytes)
        return crypto.randomBytes(3).toString('hex').toUpperCase();
    }

    private static hashOTP(otp: string): string {
        return crypto.createHash('sha256').update(otp).digest('hex');
    }

    // --- Verification Flow ---

    static async initiateEmailVerification(userId: number, email: string) {
        const code = this.generateOTP();
        const hashedCode = this.hashOTP(code);
        const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

        // Clean up old codes for this user and type
        await query('DELETE FROM auth_codes WHERE user_id = ? AND type = ?', [userId, 'EMAIL_VERIFICATION']);

        // Insert new code
        await query(
            'INSERT INTO auth_codes (user_id, type, code_hash, expires_at) VALUES (?, ?, ?, ?)',
            [userId, 'EMAIL_VERIFICATION', hashedCode, expires]
        );

        await EmailService.sendVerificationEmail(email, code); // Send PLAIN code
    }

    static async verifyEmail(email: string, code: string): Promise<{ success: boolean; message: string }> {
        const user: any = await this.findUserByEmail(email);
        if (!user) return { success: false, message: 'User not found' };

        if (user.is_verified) return { success: true, message: 'Email already verified' };

        // Find code in auth_codes
        const codes = await query<any[]>('SELECT * FROM auth_codes WHERE user_id = ? AND type = ?', [user.id, 'EMAIL_VERIFICATION']);
        const authCode = codes.length > 0 ? codes[0] : null;

        if (!authCode) return { success: false, message: 'Invalid or expired code' };

        if (new Date() > new Date(authCode.expires_at)) {
            return { success: false, message: 'Code expired' };
        }

        const hashedInput = this.hashOTP(code);
        if (hashedInput !== authCode.code_hash) {
            return { success: false, message: 'Invalid verification code' };
        }

        // Success: Update user and delete code
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            await connection.execute('UPDATE users SET is_verified = TRUE WHERE id = ?', [user.id]);
            await connection.execute('DELETE FROM auth_codes WHERE id = ?', [authCode.id]);
            await connection.commit();
        } catch (err) {
            await connection.rollback();
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

        const code = this.generateOTP();
        const hashedCode = this.hashOTP(code);
        const expires = new Date(Date.now() + 15 * 60 * 1000);

        // Clean up old codes
        await query('DELETE FROM auth_codes WHERE user_id = ? AND type = ?', [user.id, 'PASSWORD_RESET']);

        // Insert new
        await query(
            'INSERT INTO auth_codes (user_id, type, code_hash, expires_at) VALUES (?, ?, ?, ?)',
            [user.id, 'PASSWORD_RESET', hashedCode, expires]
        );

        await EmailService.sendPasswordResetEmail(email, code);
    }

    static async resetPassword(email: string, code: string, newPassword: string): Promise<{ success: boolean; message: string }> {
        const user: any = await this.findUserByEmail(email);
        if (!user) return { success: false, message: 'Invalid request' };

        // Find code
        const codes = await query<any[]>('SELECT * FROM auth_codes WHERE user_id = ? AND type = ?', [user.id, 'PASSWORD_RESET']);
        const authCode = codes.length > 0 ? codes[0] : null;

        if (!authCode) return { success: false, message: 'Invalid reset code' };

        if (new Date() > new Date(authCode.expires_at)) {
            return { success: false, message: 'Code expired' };
        }

        const hashedInput = this.hashOTP(code);
        if (hashedInput !== authCode.code_hash) {
            return { success: false, message: 'Invalid reset code' };
        }

        const hashedPassword = await this.hashPassword(newPassword);

        // Success: Update password and delete code
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            await connection.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, user.id]);
            await connection.execute('DELETE FROM auth_codes WHERE id = ?', [authCode.id]);
            await connection.commit();
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

        return { success: true, message: 'Password reset successfully' };
    }
}
