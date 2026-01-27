
import { NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ message: 'User ID required' }, { status: 400 });
        }

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

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            id, name, phone, address,
            blood_group, emergency_contact_name, emergency_contact_phone, allergies
            // allergies is now expected to be an Array of { name, severity } objects
        } = body;

        if (!id) return NextResponse.json({ message: 'ID required' }, { status: 400 });

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // 1. Update User
            await connection.execute('UPDATE users SET name = ?, phone = ? WHERE id = ?', [name, phone, id]);

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
