import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { requireRole } from '@/lib/api-auth';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';
import { EmailService } from '@/services/email.service';
import { escapeHtml } from '@/lib/html';
import { notify } from '@/lib/notify';
import { z } from 'zod';

export async function GET() {
    try {
        const auth = await requireRole('PATIENT');
        if ('error' in auth) return auth.error;
        const user = auth.user;

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
        `, [user.id, user.id, user.id, user.id, user.id]);

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

const inviteSchema = z.object({
    email: z.string().trim().email().max(255),
    relationship: z.enum(['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER']),
});

export async function POST(req: Request) {
    try {
        const auth = await requireRole('PATIENT');
        if ('error' in auth) return auth.error;
        const user = auth.user;

        const parsed = inviteSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ message: 'A valid email and relationship are required' }, { status: 400 });
        }
        const { email, relationship } = parsed.data;

        // Check if target user exists and is a PATIENT
        const members = await query<any[]>('SELECT id, name, email FROM users WHERE email = ? AND role = "PATIENT"', [email]);
        if (members.length === 0) {
            return NextResponse.json({ message: 'No patient found with that email address.' }, { status: 404 });
        }
        const member = members[0];

        if (member.id === user.id) {
            return NextResponse.json({ message: 'Cannot link your own account' }, { status: 400 });
        }

        // Already linked (either direction)?
        const existingLinks = await query<any[]>(`
            SELECT id FROM family_links
            WHERE (primary_patient_id = ? AND linked_patient_id = ?)
               OR (primary_patient_id = ? AND linked_patient_id = ?)
        `, [user.id, member.id, member.id, user.id]);
        if (existingLinks.length > 0) {
            return NextResponse.json({ message: 'Already linked to this patient' }, { status: 409 });
        }

        // A request already waiting in either direction blocks a new one
        const pending = await query<any[]>(`
            SELECT id, requester_id FROM patient_family_links
            WHERE status = 'PENDING'
              AND ((requester_id = ? AND member_id = ?) OR (requester_id = ? AND member_id = ?))
        `, [user.id, member.id, member.id, user.id]);
        if (pending.length > 0) {
            const theirs = pending[0].requester_id === member.id;
            return NextResponse.json({
                message: theirs ? 'This patient has already sent you a request. Check your incoming requests.' : 'A pending request already exists.',
            }, { status: 409 });
        }

        // Re-inviting after a rejection reuses the old row (the pair is unique); otherwise create a new request
        const previous = await query<any[]>(
            'SELECT id FROM patient_family_links WHERE requester_id = ? AND member_id = ?', [user.id, member.id]);
        try {
            if (previous.length > 0) {
                await query('UPDATE patient_family_links SET status = "PENDING", relationship = ? WHERE id = ?', [relationship, previous[0].id]);
            } else {
                await query(
                    'INSERT INTO patient_family_links (requester_id, member_id, relationship, status) VALUES (?, ?, ?, "PENDING")',
                    [user.id, member.id, relationship]);
            }
        } catch (err: any) {
            if (err?.errno === 1062) return NextResponse.json({ message: 'A pending request already exists.' }, { status: 409 });
            throw err;
        }

        // Send Email (fire and forget). Every value that came from a user is escaped.
        const [me] = await query<any[]>('SELECT name FROM users WHERE id = ?', [user.id]);
        const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/patient/family`;
        const emailHtml = `
            <h2>Family Link Request</h2>
            <p><strong>${escapeHtml(me?.name)}</strong> has requested to link medical accounts with you as: ${escapeHtml(relationship)}.</p>
            <p>If you approve this request, they will be able to manage your appointments, view lab results, and handle prescriptions on your behalf.</p>
            <a href="${dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#10b981;color:white;text-decoration:none;border-radius:5px;">Review Request</a>
        `;

        await notify(null, member.id, {
            type: 'FAMILY_REQUEST', title: 'Family link request',
            body: `${me?.name ?? 'A patient'} asked to link accounts with you as: ${relationship.toLowerCase()}.`, link: '/patient/family',
        });

        EmailService.sendEmail(
            member.email,
            'Sethro Medical - New Family Link Request',
            emailHtml
        ).catch(err => console.error('Email failed:', err));

        await audit(user, { action: 'CREATE', entity: 'FAMILY_LINK', patientId: member.id, details: { relationship, kind: 'invite' } });
        return NextResponse.json({ message: 'Request sent successfully' });

    } catch (error) {
        console.error('Family POST Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
