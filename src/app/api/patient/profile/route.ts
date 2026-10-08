
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody } from '@/lib/validate';
import { query, pool } from '@/lib/db';
import { requireRole } from '@/lib/api-auth';

export async function GET(req: Request) {
    const auth = await requireRole('PATIENT');
    if ('error' in auth) return auth.error;
    const { user } = auth;

    try {
        const { searchParams } = new URL(req.url);
        const requested = searchParams.get('userId');
        if (requested && Number(requested) !== user.id) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }
        const userId = String(user.id);

        // 1. Fetch Basic Profile
        const patients: any = await query(`
            SELECT 
                u.id, u.name, u.email, u.phone, 
                p.date_of_birth, p.gender, p.address, p.medical_history,
                p.blood_group, p.emergency_contact_name, p.emergency_contact_phone
            FROM users u
            LEFT JOIN patients p ON u.id = p.user_id
            WHERE u.id = ?
        `, [userId]);

        if (patients.length === 0) {
            return NextResponse.json({ message: 'Patient not found' }, { status: 404 });
        }

        const profile = patients[0];

        // 2. Fetch Allergies
        const allergies: any = await query(`
            SELECT allergy_name, severity FROM patient_allergies WHERE patient_id = ?
        `, [userId]);

        // Return array of objects { name, severity }
        profile.allergies = allergies.map((a: any) => ({
            name: a.allergy_name,
            severity: a.severity
        }));

        return NextResponse.json(profile);
    } catch (error) {
        console.error('Fetch Profile Error:', error);
        return NextResponse.json({ message: 'Server Error' }, { status: 500 });
    }
}

const phoneText = z.string().trim().max(20, 'Phone number is too long')
    .regex(/^[0-9+()\-\s]*$/, 'Phone number can only contain digits, spaces, + ( ) and -').nullish();

const profileSchema = z.object({
    id: z.coerce.number({ message: 'ID required' }),
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
    phone: phoneText,
    address: z.string().trim().max(500, 'Address is too long').nullish().transform((v) => v ?? ''),
    blood_group: z.string().trim().max(10, 'Blood group is invalid').nullish(),
    emergency_contact_name: z.string().trim().max(100, 'Emergency contact name is too long').nullish(),
    emergency_contact_phone: phoneText,
    // legacy clients send plain strings; current ones send { name, severity }
    allergies: z.array(z.union([
        z.string().max(100),
        z.object({ name: z.string().max(100), severity: z.enum(['MILD', 'MODERATE', 'SEVERE']).optional() }),
    ])).max(50, 'Too many allergies listed').optional(),
});

export async function POST(req: Request) {
    const auth = await requireRole('PATIENT');
    if ('error' in auth) return auth.error;
    const { user } = auth;

    try {
        // Ownership first: someone editing another person's profile gets 403 whatever else is wrong with the body
        const claimed = await req.clone().json().catch(() => null);
        if (claimed?.id !== undefined && Number(claimed.id) !== user.id) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        const body = await parseBody(req, profileSchema);
        if ('error' in body) return body.error;
        const {
            id, name, phone, address,
            blood_group, emergency_contact_name, emergency_contact_phone, allergies
        } = body.data;

        if (Number(id) !== user.id) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // 1. Update User
            await connection.execute('UPDATE users SET name = ?, phone = ? WHERE id = ?', [name, phone ?? null, id]);

            // 2. Update Patient Details
            await connection.execute(`
                UPDATE patients 
                SET address = ?, 
                    blood_group = ?, 
                    emergency_contact_name = ?, 
                    emergency_contact_phone = ?
                WHERE user_id = ?
            `, [
                address,
                blood_group || null,
                emergency_contact_name || null,
                emergency_contact_phone || null,
                id
            ]);

            // 3. Update Allergies (Delete All + Insert New)
            // This is a simple strategy for "Sync"
            await connection.execute('DELETE FROM patient_allergies WHERE patient_id = ?', [id]);

            if (Array.isArray(allergies) && allergies.length > 0) {
                for (const allergy of allergies) {
                    // Handle both string (legacy) and object formats
                    const name = typeof allergy === 'string' ? allergy : allergy.name;
                    const severity = (typeof allergy === 'object' && allergy.severity) ? allergy.severity : 'MILD';

                    if (name && name.trim() !== '') {
                        await connection.execute(
                            'INSERT INTO patient_allergies (patient_id, allergy_name, severity) VALUES (?, ?, ?)',
                            [id, name.trim(), severity]
                        );
                    }
                }
            }

            await connection.commit();
            return NextResponse.json({ message: 'Profile updated' });

        } catch (err: any) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Update Profile Error:', error);
        return NextResponse.json({ message: 'Server Error' }, { status: 500 });
    }
}
