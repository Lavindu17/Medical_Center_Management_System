import { NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, query } from '@/lib/db';
import { requireRole } from '@/lib/api-auth';
import { parseBody } from '@/lib/validate';
import { audit } from '@/lib/audit';
import { hasPresets, hasRxExtras } from '@/lib/schema-features';

const NOT_READY = { message: 'Favourites and test sets need the 21_orders.sql update. Ask the administrator to apply it.' };

/**
 * What speeds up ordering for this doctor: favourite medicines (their usual line), the medicines they prescribe most
 * recently, and their saved sets of lab tests. Everything is the signed-in doctor's own.
 */
export async function GET() {
    const auth = await requireRole('DOCTOR');
    if ('error' in auth) return auth.error;
    const { user } = auth;
    try {
        const ready = await hasPresets();
        const extras = await hasRxExtras();
        const cols = extras ? 'pi.instructions, pi.food_timing AS foodTiming, pi.as_needed AS asNeeded' : "NULL AS instructions, NULL AS foodTiming, 0 AS asNeeded";

        // Most recent line per medicine, newest first: the last 200 lines are plenty to find the doctor's usual ones
        const lines = await query<any[]>(
            `SELECT pi.medicine_id AS medicineId, pi.dosage, pi.frequency, pi.duration, ${cols}
             FROM prescription_items pi JOIN prescriptions p ON p.id = pi.prescription_id
             WHERE p.doctor_id = ? AND p.issued_at >= DATE_SUB(NOW(), INTERVAL 120 DAY) ORDER BY pi.id DESC LIMIT 200`, [user.id]);
        const seen = new Map<number, { count: number; line: any }>();
        for (const l of lines) {
            const hit = seen.get(l.medicineId);
            if (hit) hit.count++;
            else seen.set(l.medicineId, { count: 1, line: l });
        }
        const recent = [...seen.values()].sort((a, b) => b.count - a.count).slice(0, 8)
            .map(({ line }) => ({ ...line, asNeeded: Boolean(Number(line.asNeeded)) }));

        let favourites: any[] = [], panels: any[] = [];
        if (ready) {
            favourites = (await query<any[]>(
                `SELECT medicine_id AS medicineId, dosage, frequency, duration, instructions, food_timing AS foodTiming, as_needed AS asNeeded
                 FROM doctor_favourites WHERE doctor_id = ? ORDER BY created_at DESC`, [user.id])).map((f) => ({ ...f, asNeeded: Boolean(Number(f.asNeeded)) }));
            const rows = await query<any[]>(
                `SELECT p.id, p.name, pt.test_id AS testId FROM lab_panels p LEFT JOIN lab_panel_tests pt ON pt.panel_id = p.id
                 WHERE p.doctor_id = ? ORDER BY p.name, pt.test_id`, [user.id]);
            const byId = new Map<number, { id: number; name: string; testIds: number[] }>();
            for (const r of rows) {
                const panel: { id: number; name: string; testIds: number[] } = byId.get(r.id) ?? { id: r.id, name: r.name, testIds: [] };
                if (r.testId) panel.testIds.push(r.testId);
                byId.set(r.id, panel);
            }
            panels = [...byId.values()];
        }
        return NextResponse.json({ available: ready, favourites, recent, panels });
    } catch (error) {
        console.error('Presets GET error:', error);
        return NextResponse.json({ message: 'Could not load your favourites' }, { status: 500 });
    }
}

const favouriteSchema = z.object({
    type: z.literal('favourite'),
    medicineId: z.number({ message: 'Choose a medicine' }).int().positive('Choose a medicine'),
    dosage: z.string().trim().min(1, 'dosage is required').max(50),
    frequency: z.string().trim().min(1, 'frequency is required').max(50),
    duration: z.string().trim().min(1, 'duration is required').max(50),
    instructions: z.string().trim().max(255).nullish().transform((v) => v || null),
    foodTiming: z.enum(['BEFORE', 'AFTER', 'WITH']).nullish().transform((v) => v ?? null),
    asNeeded: z.boolean().nullish().transform((v) => v ?? false),
});
const panelSchema = z.object({
    type: z.literal('panel'),
    name: z.string().trim().min(1, 'Give the set a name').max(100, 'The name is too long'),
    testIds: z.array(z.number().int().positive()).min(1, 'Choose at least one test').max(50).transform((v) => [...new Set(v)]),
});
const schema = z.discriminatedUnion('type', [favouriteSchema, panelSchema]);

/** Save a favourite medicine (replaces the previous line for it) or a named set of lab tests (replaces one with the same name). */
export async function POST(req: Request) {
    const auth = await requireRole('DOCTOR');
    if ('error' in auth) return auth.error;
    const { user } = auth;
    const body = await parseBody(req, schema);
    if ('error' in body) return body.error;
    if (!(await hasPresets())) return NextResponse.json(NOT_READY, { status: 409 });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        if (body.data.type === 'favourite') {
            const d = body.data;
            const [meds]: any = await connection.execute('SELECT id FROM medicines WHERE id = ?', [d.medicineId]);
            if (meds.length === 0) { await connection.rollback(); return NextResponse.json({ message: 'That medicine does not exist' }, { status: 404 }); }
            const extras = await hasRxExtras();
            await connection.execute(
                `INSERT INTO doctor_favourites (doctor_id, medicine_id, dosage, frequency, duration, instructions, food_timing, as_needed)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE dosage = VALUES(dosage), frequency = VALUES(frequency), duration = VALUES(duration),
                   instructions = VALUES(instructions), food_timing = VALUES(food_timing), as_needed = VALUES(as_needed)`,
                [user.id, d.medicineId, d.dosage, d.frequency, d.duration, extras ? d.instructions : null, extras ? d.foodTiming : null, extras && d.asNeeded ? 1 : 0]);
            await connection.commit();
            return NextResponse.json({ message: 'Saved as a favourite' }, { status: 201 });
        }

        const d = body.data;
        const [tests]: any = await connection.query('SELECT id FROM lab_tests WHERE id IN (?)', [d.testIds]);
        if (tests.length !== d.testIds.length) { await connection.rollback(); return NextResponse.json({ message: 'One of those tests does not exist' }, { status: 400 }); }
        const [existing]: any = await connection.execute('SELECT id FROM lab_panels WHERE doctor_id = ? AND name = ?', [user.id, d.name]);
        let panelId: number = existing[0]?.id;
        if (panelId) await connection.execute('DELETE FROM lab_panel_tests WHERE panel_id = ?', [panelId]);
        else panelId = ((await connection.execute('INSERT INTO lab_panels (doctor_id, name) VALUES (?, ?)', [user.id, d.name])) as any)[0].insertId;
        await connection.query('INSERT INTO lab_panel_tests (panel_id, test_id) VALUES ?', [d.testIds.map((t) => [panelId, t])]);
        await connection.commit();
        await audit(user, { action: 'CREATE', entity: 'LAB_PANEL', entityId: panelId, details: { name: d.name, tests: d.testIds.length } });
        return NextResponse.json({ id: panelId, message: 'Saved' }, { status: 201 });
    } catch (error) {
        await connection.rollback().catch(() => {});
        console.error('Presets POST error:', error);
        return NextResponse.json({ message: 'Could not save' }, { status: 500 });
    } finally {
        connection.release();
    }
}

/** Remove a favourite (?type=favourite&medicineId=) or a test set (?type=panel&id=). Only the doctor's own. */
export async function DELETE(req: Request) {
    const auth = await requireRole('DOCTOR');
    if ('error' in auth) return auth.error;
    const { user } = auth;
    try {
        if (!(await hasPresets())) return NextResponse.json(NOT_READY, { status: 409 });
        const params = new URL(req.url).searchParams;
        const type = params.get('type');
        const id = Number(params.get(type === 'favourite' ? 'medicineId' : 'id'));
        if ((type !== 'favourite' && type !== 'panel') || !Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ message: 'Say what to remove: type=favourite&medicineId=… or type=panel&id=…' }, { status: 400 });
        }
        const res: any = type === 'favourite'
            ? await query('DELETE FROM doctor_favourites WHERE doctor_id = ? AND medicine_id = ?', [user.id, id])
            : await query('DELETE FROM lab_panels WHERE doctor_id = ? AND id = ?', [user.id, id]);
        if (res.affectedRows === 0) return NextResponse.json({ message: 'Not found' }, { status: 404 });
        return NextResponse.json({ message: 'Removed' });
    } catch (error) {
        console.error('Presets DELETE error:', error);
        return NextResponse.json({ message: 'Could not remove' }, { status: 500 });
    }
}
