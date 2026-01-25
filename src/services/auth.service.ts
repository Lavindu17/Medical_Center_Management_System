import { User, Role } from '@/types';
import { pool, query } from '@/lib/db';
import bcrypt from 'bcrypt';
import { SignJWT, jwtVerify } from 'jose';

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
}
