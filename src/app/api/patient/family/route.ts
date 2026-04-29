import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';
import { EmailService } from '@/services/email.service';

// Helper
async function getPatient() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;
    const user = await AuthService.verifyToken(token);
    if (!user || user.role !== 'PATIENT') return null;
    return user;
}

export async function GET() {
    try {
        const user = await getPatient();
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        // 1. Linked Members (Bi-Directional from family_links)
        // We get both the ones where the user is primary, and where user is linked
        const linkedMembers = await query<any[]>(`
            SELECT 
                fl.id as link_id, 
                fl.relationship,
                CASE 
                    WHEN fl.primary_patient_id = ? THEN u2.id
                    ELSE u1.id
                END as member_id,
                CASE 
                    WHEN fl.primary_patient_id = ? THEN u2.name
                    ELSE u1.name
                END as name,
                CASE 
                    WHEN fl.primary_patient_id = ? THEN u2.email
                    ELSE u1.email
                END as email
            FROM family_links fl
            LEFT JOIN users u1 ON fl.primary_patient_id = u1.id
            LEFT JOIN users u2 ON fl.linked_patient_id = u2.id
            WHERE fl.primary_patient_id = ? OR fl.linked_patient_id = ?
        `, [user.id, user.id, user.id, user.id, user.id, user.id, user.id]);

        // 2. Incoming Requests (patient_family_links where member_id = user.id AND status = 'PENDING')
        const incomingRequests = await query<any[]>(`
            SELECT pfl.id, pfl.requester_id, u.name as requester_name, u.email as requester_email, pfl.relationship, pfl.created_at
            FROM patient_family_links pfl
            JOIN users u ON pfl.requester_id = u.id
            WHERE pfl.member_id = ? AND pfl.status = 'PENDING'
        `, [user.id]);

        // 3. Outgoing Requests
        const outgoingRequests = await query<any[]>(`
            SELECT pfl.id, pfl.member_id, u.name as member_name, u.email as member_email, pfl.relationship, pfl.status, pfl.created_at
            FROM patient_family_links pfl
            JOIN users u ON pfl.member_id = u.id
            WHERE pfl.requester_id = ? AND pfl.status = 'PENDING'
        `, [user.id]);

        return NextResponse.json({
            linked_members: linkedMembers,
            incoming_requests: incomingRequests,
            outgoing_requests: outgoingRequests
        });

    } catch (error) {
        console.error('Family GET Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const user = await getPatient();
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { email, relationship } = body;

        if (!email || !relationship) {
            return NextResponse.json({ message: 'Email and relationship are required' }, { status: 400 });
        }

        if (email.toLowerCase() === (user as any).email?.toLowerCase()) {
            return NextResponse.json({ message: 'Cannot link your own account' }, { status: 400 });
        }

        // Check if target user exists and is a PATIENT
        const members = await query<any[]>('SELECT id, name FROM users WHERE email = ? AND role = "PATIENT"', [email]);
        if (members.length === 0) {
            return NextResponse.json({ message: 'No patient found with that email address.' }, { status: 404 });
        }
        const member = members[0];

        // Check if already linked
        const existingLinks = await query<any[]>(`
            SELECT id FROM family_links 
            WHERE (primary_patient_id = ? AND linked_patient_id = ?) 
               OR (primary_patient_id = ? AND linked_patient_id = ?)
        `, [user.id, member.id, member.id, user.id]);

        if (existingLinks.length > 0) {
            return NextResponse.json({ message: 'Already linked to this patient' }, { status: 409 });
        }

        // Check if pending request exists
        const pending = await query<any[]>(`
            SELECT id FROM patient_family_links 
            WHERE requester_id = ? AND member_id = ? AND status = 'PENDING'
        `, [user.id, member.id]);

        if (pending.length > 0) {
            return NextResponse.json({ message: 'A pending request already exists.' }, { status: 409 });
        }

        // Insert Request
        await query(
            'INSERT INTO patient_family_links (requester_id, member_id, relationship, status) VALUES (?, ?, ?, "PENDING")',
            [user.id, member.id, relationship]
        );

        // Send Email (Fire and forget)
        const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/patient/family`;
        const emailHtml = `
            <h2>Family Link Request</h2>
            <p><strong>${user.name}</strong> has requested to link medical accounts with you as: ${relationship}.</p>
            <p>If you approve this request, they will be able to manage your appointments, view lab results, and handle prescriptions on your behalf.</p>
            <a href="${dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#10b981;color:white;text-decoration:none;border-radius:5px;">Review Request</a>
        `;
        
        EmailService.sendEmail(
            email,
            'Sethro Medical - New Family Link Request',
            emailHtml
        ).catch(err => console.error('Email failed:', err));

        return NextResponse.json({ message: 'Request sent successfully' });

    } catch (error) {
        console.error('Family POST Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
