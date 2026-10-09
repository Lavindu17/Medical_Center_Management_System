import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { audit } from '@/lib/audit';
import { listAudit, parseFilters } from '@/lib/audit-query';

const PAGE = 50;

/** The audit trail, newest first, filterable. Administrators only; looking at it is itself recorded. */
export async function GET(req: Request) {
    const auth = await requireRole('ADMIN');
    if ('error' in auth) return auth.error;

    try {
        const filters = parseFilters(new URL(req.url).searchParams);
        const rows = await listAudit(filters, PAGE + 1);
        const hasMore = rows.length > PAGE;
        const page = hasMore ? rows.slice(0, PAGE) : rows;

        // Only the first page is logged: scrolling through older rows should not flood the log with its own reads
        if (!filters.cursor) {
            await audit(auth.user, { action: 'VIEW', entity: 'AUDIT_LOG', details: { ...filters, results: page.length } as Record<string, unknown> });
        }
        return NextResponse.json({ rows: page, nextCursor: hasMore ? page[page.length - 1].id : null });
    } catch (error) {
        console.error('Audit list error:', error);
        return NextResponse.json({ message: 'Could not load the audit log' }, { status: 500 });
    }
}
