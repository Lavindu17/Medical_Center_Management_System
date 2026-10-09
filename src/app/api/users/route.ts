import { NextResponse } from 'next/server';
import { audit, changedFields } from '@/lib/audit';
import { query, pool } from '@/lib/db';
import { AuthService } from '@/services/auth.service';
import { z } from 'zod';
import { requireRole } from '@/lib/api-auth';

/**
 * API route for managing users in the Sethro Medical Center system.
 * Handles CRUD operations for user accounts including doctors, pharmacists, etc.
 */

// Fetch all users
export async function GET(req: Request) {
    const auth = await requireRole('ADMIN');
    if ('error' in auth) return auth.error;

    try {
        // Query to retrieve all users with basic information, ordered by creation date
        const users = await query<any[]>('SELECT id, name, email, role, phone, created_at as createdAt FROM users ORDER BY created_at DESC');
        await audit(auth.user, { action: 'SEARCH', entity: 'USER', details: { results: users.length } });
        return NextResponse.json(users);
    } catch (error) {
        return NextResponse.json({ message: 'Failed to fetch users' }, { status: 500 });
    }
}

const createUserSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(['DOCTOR', 'PHARMACIST', 'LAB_ASSISTANT', 'RECEPTIONIST', 'ADMIN']),
    phone: z.string().optional(),
    // Doctor specific
    specialization: z.string().optional(),
    licenseNumber: z.string().optional(),
});

/**
 * Create a new staff user in the system.
 * Validates input, checks for existing user, and handles doctor-specific fields.
 */
export async function POST(req: Request) {
    const auth = await requireRole('ADMIN');
    if ('error' in auth) return auth.error;

    try {
        const body = await req.json();
        const validation = createUserSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten() }, { status: 400 });
        }

        const { name, email, password, role, phone, specialization, licenseNumber } = validation.data;

        const existingUser = await AuthService.findUserByEmail(email);
        if (existingUser) {
            return NextResponse.json({ message: 'User already exists' }, { status: 409 });
        }

        if (role === 'DOCTOR' && (!specialization || !licenseNumber)) {
            return NextResponse.json({ message: 'Specialization and License Number are required for Doctors' }, { status: 400 });
        }

        // Start database transaction for atomicity
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const hashedPassword = await AuthService.hashPassword(password);

            // Insert new user into users table
            const [result]: any = await connection.execute(
                'INSERT INTO users (email, password_hash, name, role, phone, is_verified) VALUES (?, ?, ?, ?, ?, TRUE)',
                [email, hashedPassword, name, role, phone || null]
            );

            const userId = result.insertId;

            // If role is DOCTOR, insert additional doctor-specific information
            if (role === 'DOCTOR') {
                if (!specialization || !licenseNumber) {
                    throw new Error('Specialization and License Number are required for Doctors');
                }
                await connection.execute(
                    'INSERT INTO doctors (user_id, specialization, license_number) VALUES (?, ?, ?)',
                    [userId, specialization, licenseNumber]
                );
            }

            // Commit transaction on success
            await connection.commit();
            await audit(auth.user, { action: 'CREATE', entity: 'USER', entityId: userId, patientId: null, details: { role } });
            return NextResponse.json({ message: 'User created successfully' }, { status: 201 });

        } catch (err: any) {
            // Rollback transaction on error
            await connection.rollback();
            console.error('Create User Error:', err);
            return NextResponse.json({ message: 'Failed to create user' }, { status: 500 });
        } finally {
            // Always release the connection
            connection.release();
        }

    } catch (error) {
        console.error('Create User Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

const updateUserSchema = z.object({
    id: z.number(),
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().optional(),
    role: z.enum(['DOCTOR', 'PHARMACIST', 'LAB_ASSISTANT', 'RECEPTIONIST', 'ADMIN', 'PATIENT']),
});

/**
 * Update an existing user's information.
 * Validates input and updates the user record in the database.
 */
export async function PUT(req: Request) {
    const auth = await requireRole('ADMIN');
    if ('error' in auth) return auth.error;
    const { user: admin } = auth;

    try {
        const body = await req.json();
        const validation = updateUserSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten() }, { status: 400 });
        }

        const { id, name, email, phone, role } = validation.data;

        const existingUser = await query<any[]>('SELECT role, name, email, phone FROM users WHERE id = ?', [id]);
        if (existingUser.length === 0) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }
        // Doctors and patients have a profile row; changing to or from those roles would orphan or invent it
        if (existingUser[0].role !== role && [existingUser[0].role, role].some((r) => r === 'DOCTOR' || r === 'PATIENT')) {
            return NextResponse.json({ message: 'Roles cannot be changed to or from Doctor or Patient. Create a new account instead.' }, { status: 400 });
        }
        if (id === admin.id && role !== 'ADMIN') {
            return NextResponse.json({ message: 'You cannot change your own role' }, { status: 400 });
        }
        const clash = await query<any[]>('SELECT id FROM users WHERE email = ? AND id <> ?', [email, id]);
        if (clash.length > 0) {
            return NextResponse.json({ message: 'Email already in use' }, { status: 409 });
        }

        // Update user information in the database
        await query(
            'UPDATE users SET name = ?, email = ?, phone = ?, role = ? WHERE id = ?',
            [name, email, phone || null, role, id]
        );

        await audit(admin, {
            action: 'UPDATE', entity: 'USER', entityId: id, patientId: role === 'PATIENT' ? id : null,
            details: { fields: changedFields(existingUser[0], { name, email, phone: phone || null, role }), ...(existingUser[0].role !== role ? { roleFrom: existingUser[0].role, roleTo: role } : {}) },
        });
        return NextResponse.json({ message: 'User updated successfully' });

    } catch (error) {
        console.error('Update User Error:', error);
        return NextResponse.json({ message: 'Failed to update user' }, { status: 500 });
    }
}

// Delete User
/**
 * Delete a user from the system by ID.
 * Uses DELETE CASCADE in schema to handle related records.
 */
export async function DELETE(req: Request) {
    const auth = await requireRole('ADMIN');
    if ('error' in auth) return auth.error;
    const { user: admin } = auth;

    try {
        const { searchParams } = new URL(req.url);
        const id = Number(searchParams.get('id'));

        if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ message: 'A valid ID is required' }, { status: 400 });
        if (id === admin.id) return NextResponse.json({ message: 'You cannot delete your own account' }, { status: 400 });

        const target = await query<any[]>('SELECT role FROM users WHERE id = ?', [id]);
        if (target.length === 0) return NextResponse.json({ message: 'User not found' }, { status: 404 });
        if (target[0].role === 'ADMIN') {
            const admins = await query<any[]>("SELECT COUNT(*) AS n FROM users WHERE role = 'ADMIN'");
            if (Number(admins[0].n) <= 1) {
                return NextResponse.json({ message: 'The last administrator cannot be deleted' }, { status: 409 });
            }
        }

        // Delete user from database; related records handled by CASCADE
        await query('DELETE FROM users WHERE id = ?', [id]);
        await audit(admin, { action: 'DELETE', entity: 'USER', entityId: id, patientId: target[0].role === 'PATIENT' ? id : null, details: { role: target[0].role } });

        return NextResponse.json({ message: 'User deleted successfully' });

    } catch (error: any) {
        // Appointments, prescriptions and bills keep a reference to the people involved
        if (error?.errno === 1451) {
            return NextResponse.json({ message: 'This user has appointments or medical records and cannot be deleted.' }, { status: 409 });
        }
        console.error('Delete User Error:', error);
        return NextResponse.json({ message: 'Failed to delete user' }, { status: 500 });
    }
}
