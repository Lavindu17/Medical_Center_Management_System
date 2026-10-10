import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { parseBody } from '@/lib/validate';
import { requireHr, hrFailure } from '@/lib/hr-auth';
import { HrError, checkShiftTimes } from '@/lib/hr';
import { isTime, normTime } from '@/lib/hr-time';

const schema = z.object({
    id: z.number().int().positive().optional(),
    name: z.string().trim().min(1, 'Give the preset a name').max(60),
    start: z.string().refine(isTime, 'Enter a valid start time'),
    end: z.string().refine(isTime, 'Enter a valid finish time'),
    active: z.boolean().default(true),
});

const list = () => query<any[]>(`SELECT id, name, TIME_FORMAT(start_time, '%H:%i') AS start, TIME_FORMAT(end_time, '%H:%i') AS end, active FROM shift_templates ORDER BY start_time, name`);

/** Shift presets: quick-fill buttons for the roster form. */
export async function GET() {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    try {
        return NextResponse.json({ templates: await list() });
    } catch (err) {
        return hrFailure(err, 'HR presets');
    }
}

/** Create a preset, or change one (send its id). Presets are never deleted, only switched off. */
export async function POST(req: Request) {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    const body = await parseBody(req, schema);
    if ('error' in body) return body.error;
    try {
        const { id, name, start, end, active } = body.data;
        checkShiftTimes([{ start, end }]);
        try {
            if (id) {
                const res: any = await query('UPDATE shift_templates SET name = ?, start_time = ?, end_time = ?, active = ? WHERE id = ?', [name, normTime(start), normTime(end), active ? 1 : 0, id]);
                if (res.affectedRows === 0) throw new HrError(404, 'Preset not found');
            } else {
                await query('INSERT INTO shift_templates (name, start_time, end_time, active) VALUES (?, ?, ?, ?)', [name, normTime(start), normTime(end), active ? 1 : 0]);
            }
        } catch (err: any) {
            if (err?.errno === 1062) throw new HrError(409, 'A preset with that name already exists');
            throw err;
        }
        await audit(auth.user, { action: id ? 'UPDATE' : 'CREATE', entity: 'SHIFT', entityId: id ?? null, details: { preset: name } });
        return NextResponse.json({ templates: await list() }, { status: id ? 200 : 201 });
    } catch (err) {
        return hrFailure(err, 'HR save preset');
    }
}
