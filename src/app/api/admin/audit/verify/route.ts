import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { audit, verifyChain } from '@/lib/audit';

/**
 * Recomputes the hash chain. A clean result means no row was changed or removed from the middle of the trail.
 * Keep the returned `head` somewhere outside the database: it is what would reveal rows cut off the end.
 */
export async function POST() {
    const auth = await requireRole('ADMIN');
    if ('error' in auth) return auth.error;

    try {
        const report = await verifyChain();
        await audit(auth.user, { action: 'VERIFY_CHAIN', entity: 'AUDIT_LOG', outcome: report.ok ? 'SUCCESS' : 'FAILURE', details: { checked: report.checked, firstBadId: report.firstBadId } });
        return NextResponse.json(report);
    } catch (error) {
        console.error('Audit verify error:', error);
        return NextResponse.json({ message: 'Could not verify the audit log' }, { status: 500 });
    }
}
