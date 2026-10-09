import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { z } from 'zod';
import { pool } from '@/lib/db';
import { requireRole } from '@/lib/api-auth';

const schema = z.object({
    primary_patient_id: z.coerce.number().int().positive(),
    linked_patient_id: z.coerce.number().int().positive(),
    relationship: z.enum(['PARENT', 'CHILD', 'SPOUSE', 'SIBLING', 'OTHER']),
}).refine((v) => v.primary_patient_id !== v.linked_patient_id, { message: 'Cannot link patient to themselves' });

// Reception links two patients whose identity and relationship they have checked in person.
export async function POST(req: Request) {
    const auth = await requireRole('RECEPTIONIST', 'ADMIN');
    if ('error' in auth) return auth.error;
    const { user } = auth;

    try {
        const parsed = schema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ message: parsed.error.issues[0]?.message || 'Missing fields' }, { status: 400 });
        }
        const { primary_patient_id, linked_patient_id, relationship } = parsed.data;

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [patients]: any = await connection.execute(
                `SELECT p.user_id FROM patients p JOIN users u ON u.id = p.user_id
                 WHERE u.role = 'PATIENT' AND p.user_id IN (?, ?)`, [primary_patient_id, linked_patient_id]);
            if (patients.length !== 2) {
                await connection.rollback();
                return NextResponse.json({ message: 'Both accounts must be existing patients' }, { status: 404 });
            }

            // A link works in both directions, so A->B and B->A are the same link
            const [existing]: any = await connection.execute(
                `SELECT id FROM family_links
                 WHERE (primary_patient_id = ? AND linked_patient_id = ?) OR (primary_patient_id = ? AND linked_patient_id = ?)
                 FOR UPDATE`, [primary_patient_id, linked_patient_id, linked_patient_id, primary_patient_id]);
            if (existing.length > 0) {
                await connection.rollback();
                return NextResponse.json({ message: 'Already linked' }, { status: 409 });
            }

            await connection.execute(
                `INSERT INTO family_links (primary_patient_id, linked_patient_id, relationship, verified_by) VALUES (?, ?, ?, ?)`,
                [primary_patient_id, linked_patient_id, relationship, user.id]);
            await connection.commit();
            await audit(user, { action: 'CREATE', entity: 'FAMILY_LINK', patientId: primary_patient_id, details: { linkedPatientId: linked_patient_id, relationship, by: 'reception' } });
            return NextResponse.json({ message: 'Patients Linked Successfully' });
        } catch (err: any) {
            await connection.rollback().catch(() => {});
            if (err?.errno === 1062) return NextResponse.json({ message: 'Already linked' }, { status: 409 });
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Link Error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
