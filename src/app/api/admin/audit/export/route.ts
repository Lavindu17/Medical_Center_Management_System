import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { audit } from '@/lib/audit';
import { listAudit, parseFilters, toCsv } from '@/lib/audit-query';

const MAX_ROWS = 10_000;

/** CSV export of the filtered trail (at most 10,000 rows). The export is recorded: who took a copy, and what they asked for. */
export async function GET(req: Request) {
    const auth = await requireRole('ADMIN');
    if ('error' in auth) return auth.error;

    try {
        const filters = parseFilters(new URL(req.url).searchParams);
        delete filters.cursor;
        const rows = await listAudit(filters, MAX_ROWS);
        await audit(auth.user, { action: 'EXPORT', entity: 'AUDIT_LOG', details: { ...filters, rows: rows.length } as Record<string, unknown> });

        return new NextResponse(toCsv(rows), {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
                'Cache-Control': 'private, no-store',
            },
        });
    } catch (error) {
        console.error('Audit export error:', error);
        return NextResponse.json({ message: 'Could not export the audit log' }, { status: 500 });
    }
}
