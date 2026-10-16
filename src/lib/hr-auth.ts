import 'server-only';
import { NextResponse } from 'next/server';
import { requireStaffMember } from '@/lib/api-auth';
import { clientIp } from '@/lib/audit-core';
import { HrError } from '@/lib/hr';

/** Any signed-in member of staff (not patients): everyone has a "My Work" page. */
export const requireStaff = requireStaffMember;

/** Turns a broken rule into its 4xx response; anything else is a 500 that is logged. */
export function hrFailure(err: unknown, what: string): NextResponse {
    if (err instanceof HrError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error(`${what}:`, err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 500 });
}

export async function requestIp(): Promise<string | null> {
    try {
        const { headers } = await import('next/headers');
        return clientIp(await headers());
    } catch {
        return null;
    }
}
