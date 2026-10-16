import { NextResponse } from 'next/server';
import { AccessError, NOT_READY, isTablesMissing } from './admin';

/** Turns a failed access-control action into its response: a rule broken is a 4xx, a missing migration says so, anything else is logged. */
export function accessFailure(err: unknown, what: string): NextResponse {
    if (err instanceof AccessError) return NextResponse.json({ message: err.message }, { status: err.status });
    if (isTablesMissing(err)) return NextResponse.json({ message: NOT_READY.message }, { status: NOT_READY.status });
    if ((err as any)?.errno === 1062) return NextResponse.json({ message: 'A profile with that name already exists.' }, { status: 409 });
    console.error(`${what}:`, err);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 500 });
}
