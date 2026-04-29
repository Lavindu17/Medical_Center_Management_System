import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';
import { query } from '@/lib/db';
import { User } from '@/types';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        // Get session
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token');

        if (!token) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const payload = await AuthService.verifyToken(token.value);
        if (!payload) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // Get user from DB to get the actual hash
        const users = await query<any[]>('SELECT * FROM users WHERE id = ?', [payload.id]);
        if (users.length === 0) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }

        const user = users[0];

        // check current password
        const isValid = await AuthService.comparePassword(currentPassword, user.password_hash);
        if (!isValid) {
            return NextResponse.json({ message: 'Incorrect current password' }, { status: 400 });
        }

        // update password
        const newHash = await AuthService.hashPassword(newPassword);
        await query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);

        return NextResponse.json({ success: true, message: 'Password updated successfully' });

    } catch (error) {
        console.error('Change Password Error:', error);
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}
