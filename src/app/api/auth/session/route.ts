import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

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

        return NextResponse.json({ user: payload });

    } catch (error) {
        console.error('Session Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
