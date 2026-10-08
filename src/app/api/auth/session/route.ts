import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';
import { query } from '@/lib/db';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const payload = await AuthService.verifyToken(token);

        if (!payload) {
            return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
        }

        // The token carries the name from sign-in time; show the current one after a profile edit
        const rows = await query<any[]>('SELECT name, email FROM users WHERE id = ?', [payload.id]);
        return NextResponse.json({ user: { ...payload, ...(rows[0] ?? {}) } });

    } catch (error) {
        console.error('Session Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
