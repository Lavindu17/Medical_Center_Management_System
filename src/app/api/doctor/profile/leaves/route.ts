import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        const user = await AuthService.verifyToken(token || '');
        if (!user || user.role !== 'DOCTOR') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const { date, reason } = await req.json();

        const [res]: any = await query(
            'INSERT INTO doctor_leaves (doctor_id, date, reason) VALUES (?, ?, ?)',
            [user.id, date, reason]
        );

        return NextResponse.json({ id: res.insertId, date, reason, doctor_id: user.id });

    } catch (error) {
        return NextResponse.json({ message: 'Error or Duplicate Date' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        const user = await AuthService.verifyToken(token || '');
        if (!user || user.role !== 'DOCTOR') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        await query('DELETE FROM doctor_leaves WHERE id = ? AND doctor_id = ?', [id, user.id]);

        return NextResponse.json({ message: 'Deleted' });

    } catch (error) {
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
