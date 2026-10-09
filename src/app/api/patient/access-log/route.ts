import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { patientAccessHistory } from '@/lib/audit-query';

const PAGE = 20;

/** Who has handled the signed-in patient's record: people and roles, what they did and when. */
export async function GET(req: Request) {
    const auth = await requireRole('PATIENT');
    if ('error' in auth) return auth.error;

    try {
        const raw = Number(new URL(req.url).searchParams.get('cursor'));
        const cursor = Number.isInteger(raw) && raw > 0 ? raw : undefined;
        const rows = await patientAccessHistory(auth.user.id, PAGE + 1, cursor);
        const hasMore = rows.length > PAGE;
        const page = hasMore ? rows.slice(0, PAGE) : rows;
        return NextResponse.json({ rows: page, nextCursor: hasMore ? page[page.length - 1].id : null });
    } catch (error) {
        console.error('Access history error:', error);
        return NextResponse.json({ message: 'Could not load your access history' }, { status: 500 });
    }
}
