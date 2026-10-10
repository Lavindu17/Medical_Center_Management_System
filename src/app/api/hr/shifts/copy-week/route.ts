import { NextResponse } from 'next/server';
import { z } from 'zod';
import { audit } from '@/lib/audit';
import { parseBody } from '@/lib/validate';
import { requireHr, hrFailure } from '@/lib/hr-auth';
import { copyWeek, loadSettings } from '@/lib/hr';
import { isDay } from '@/lib/hr-time';

const schema = z.object({
    fromMonday: z.string().refine(isDay, 'Choose the week to copy'),
    toMonday: z.string().refine(isDay, 'Choose the week to copy to'),
});

/** Repeat one week of the roster onto another. Conflicts are skipped and reported. */
export async function POST(req: Request) {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    const body = await parseBody(req, schema);
    if ('error' in body) return body.error;
    try {
        const settings = await loadSettings();
        const result = await copyWeek(auth.user.id, body.data.fromMonday, body.data.toMonday, settings.timezone);
        await audit(auth.user, { action: 'CREATE', entity: 'SHIFT', details: { copiedFrom: body.data.fromMonday, copiedTo: body.data.toMonday, created: result.created, skipped: result.skipped.length } });
        return NextResponse.json(result, { status: result.created > 0 ? 201 : 200 });
    } catch (err) {
        return hrFailure(err, 'HR copy week');
    }
}
