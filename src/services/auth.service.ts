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

        await query(
            'UPDATE users SET verification_code = ?, verification_expires = ? WHERE id = ?',
            [hashedCode, expires, userId]
        );

        await EmailService.sendVerificationEmail(email, code); // Send PLAIN code
    }

    static async verifyEmail(email: string, code: string): Promise<{ success: boolean; message: string }> {
        const user: any = await this.findUserByEmail(email);
        if (!user) return { success: false, message: 'User not found' };

        if (user.is_verified) return { success: true, message: 'Email already verified' };
        if (!user.verification_code || !user.verification_expires) return { success: false, message: 'Invalid code' };

        if (new Date() > new Date(user.verification_expires)) {
            return { success: false, message: 'Code expired' };
        }

        const hashedInput = this.hashOTP(code);
        if (hashedInput !== user.verification_code) {
            return { success: false, message: 'Invalid verification code' };
        }

        await query(
            'UPDATE users SET is_verified = TRUE, verification_code = NULL, verification_expires = NULL WHERE id = ?',
            [user.id]
        );

        return { success: true, message: 'Email verified successfully' };
    }

    // --- Forgot Password Flow ---

    static async initiatePasswordReset(email: string) {
        const user: any = await this.findUserByEmail(email);
        if (!user) return; // Security: do nothing if user not found (or log internally)

        const code = this.generateOTP();
        const hashedCode = this.hashOTP(code);
        const expires = new Date(Date.now() + 15 * 60 * 1000);

        await query(
            'UPDATE users SET reset_code = ?, reset_expires = ? WHERE id = ?',
            [hashedCode, expires, user.id]
        );

        await EmailService.sendPasswordResetEmail(email, code); // Send PLAIN code
    }

    static async resetPassword(email: string, code: string, newPassword: string): Promise<{ success: boolean; message: string }> {
        const user: any = await this.findUserByEmail(email);
        if (!user) return { success: false, message: 'Invalid request' };

        if (!user.reset_code || !user.reset_expires) return { success: false, message: 'Invalid reset code' };

        if (new Date() > new Date(user.reset_expires)) {
            return { success: false, message: 'Code expired' };
        }

        const hashedInput = this.hashOTP(code);
        if (hashedInput !== user.reset_code) {
            return { success: false, message: 'Invalid reset code' };
        }

        const hashedPassword = await this.hashPassword(newPassword);

        await query(
            'UPDATE users SET password_hash = ?, reset_code = NULL, reset_expires = NULL WHERE id = ?',
            [hashedPassword, user.id]
        );

        return { success: true, message: 'Password reset successfully' };
    }
}
