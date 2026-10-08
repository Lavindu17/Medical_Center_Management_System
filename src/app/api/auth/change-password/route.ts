import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';
import { query } from '@/lib/db';
import { User } from '@/types';

export async function POST(req: Request) {
    try {
        const token = (await cookies()).get('token')?.value;
        const payload = token ? await AuthService.verifyToken(token) : null;
        if (!payload) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const { currentPassword, newPassword } = await req.json();

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }
        if (typeof newPassword !== 'string' || newPassword.length < 6) {
            return NextResponse.json({ message: 'New password must be at least 6 characters' }, { status: 400 });
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
