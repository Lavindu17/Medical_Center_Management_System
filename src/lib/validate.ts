import { NextResponse } from 'next/server';
import type { z } from 'zod';

/**
 * Reads and validates a JSON body. On bad input the route gets a ready-made 400 in the standard
 * `{ message }` shape (with the offending field name when there is one):
 *
 *   const body = await parseBody(req, schema);
 *   if ('error' in body) return body.error;
 *   const { name } = body.data;
 */
export async function parseBody<S extends z.ZodTypeAny>(
    req: Request,
    schema: S,
): Promise<{ data: z.infer<S> } | { error: NextResponse }> {
    const raw = await req.json().catch(() => undefined);
    const parsed = schema.safeParse(raw);
    if (parsed.success) return { data: parsed.data };
    const issue = parsed.error.issues[0];
    return {
        error: NextResponse.json(
            { message: raw === undefined ? 'Request body must be valid JSON' : issue.message, field: issue.path[0] },
            { status: 400 },
        ),
    };
}
