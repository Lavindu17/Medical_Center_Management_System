import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        
        const currentUser = await AuthService.verifyToken(token);
        if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { target_user_id } = body;

        if (!target_user_id) {
            return NextResponse.json({ message: 'Target user ID required' }, { status: 400 });
        }

        // If they specify their own ID, somehow they want to switch to themselves? 
        // Just return success context without doing anything if it matches.
        if (currentUser.id === target_user_id) {
            return NextResponse.json({ message: 'Already operating as this user' });
        }

        // 1. Verify existence of the family link
        const links = await query<any[]>(`
            SELECT id FROM family_links 
            WHERE (primary_patient_id = ? AND linked_patient_id = ?) 
               OR (primary_patient_id = ? AND linked_patient_id = ?)
        `, [currentUser.id, target_user_id, target_user_id, currentUser.id]);

        if (links.length === 0) {
            return NextResponse.json({ message: 'Unauthorized. Accounts are not linked.' }, { status: 403 });
        }

        // 2. Fetch Target User Data
        const targets = await query<any[]>('SELECT * FROM users WHERE id = ?', [target_user_id]);
        if (targets.length === 0) {
            return NextResponse.json({ message: 'Target user not found' }, { status: 404 });
        }
        const targetUser = targets[0];

        // 3. Generate New JWT Token entirely scoped to target_user
        // By relying strictly on the bi-directional nature of 'family_links', 
        // the target_user can ALSO see currentUser in their family dashboard and switch back organically.
        const newToken = await AuthService.generateToken(targetUser);

        // 4. Set Cookie Overwrite
        cookieStore.set({
            name: 'token',
            value: newToken,
            httpOnly: true,
            path: '/',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24, // 1 day
        });

        // Safe return
        const { password_hash, ...safeUser } = targetUser;
        return NextResponse.json({
            message: 'Switched context successfully',
            user: safeUser
        });

    } catch (error) {
        console.error('Account Switch Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
