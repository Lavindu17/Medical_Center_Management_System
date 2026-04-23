import { NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';
import { AuthService } from '@/services/auth.service';
import { z } from 'zod';

/**
 * API route for managing users in the Sethro Medical Center system.
 * Handles CRUD operations for user accounts including doctors, pharmacists, etc.
 */

// Fetch all users
export async function GET(req: Request) {
    try {
        // Query to retrieve all users with basic information, ordered by creation date
        const users = await query<any[]>('SELECT id, name, email, role, phone, created_at as createdAt FROM users ORDER BY created_at DESC');
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

        // Start database transaction for atomicity
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const hashedPassword = await AuthService.hashPassword(password);

            // Insert new user into users table
            const [result]: any = await connection.execute(
                'INSERT INTO users (email, password_hash, name, role, phone) VALUES (?, ?, ?, ?, ?)',
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
            return NextResponse.json({ message: 'User created successfully' }, { status: 201 });

        } catch (err: any) {
            // Rollback transaction on error
            await connection.rollback();
            return NextResponse.json({ message: err.message || 'Database error' }, { status: 500 });
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
    try {
        const body = await req.json();
        const validation = updateUserSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten() }, { status: 400 });
        }

        const { id, name, email, phone, role } = validation.data;

        // Update user information in the database
        await query(
            'UPDATE users SET name = ?, email = ?, phone = ?, role = ? WHERE id = ?',
            [name, email, phone || null, role, id]
        );

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
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ message: 'ID required' }, { status: 400 });

        // Delete user from database; related records handled by CASCADE
        await query('DELETE FROM users WHERE id = ?', [id]);

        return NextResponse.json({ message: 'User deleted successfully' });

    } catch (error) {
        console.error('Delete User Error:', error);
        return NextResponse.json({ message: 'Failed to delete user' }, { status: 500 });
    }
}
