import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { query } from '@/lib/db';
import { requireRole } from '@/lib/api-auth';
import { auditAccess } from '@/lib/audit';
import { isSafeStoredName, mimeForStoredName, reportDir } from '@/lib/lab-reports';

// GET a lab report. Reports are private: only the lab team, the patient they belong to and the
// doctor who requested them can open one.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole('PATIENT', 'DOCTOR', 'LAB_ASSISTANT', 'ADMIN');
    if ('error' in auth) return auth.error;
    const { user } = auth;

    try {
        const requestId = Number((await params).id);
        if (!Number.isInteger(requestId) || requestId <= 0) {
            return NextResponse.json({ message: 'Invalid report id' }, { status: 400 });
        }

        const rows = await query<any[]>(
            `SELECT lr.result_file, a.patient_id, a.doctor_id
             FROM lab_requests lr JOIN appointments a ON a.id = lr.appointment_id WHERE lr.id = ?`,
            [requestId]);
        const report = rows[0];
        if (!report || !report.result_file || !isSafeStoredName(report.result_file)) {
            return NextResponse.json({ message: 'Report not found' }, { status: 404 });
        }
        if ((user.role === 'PATIENT' && report.patient_id !== user.id) || (user.role === 'DOCTOR' && report.doctor_id !== user.id)) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        const bytes = await readFile(path.join(reportDir(), report.result_file)).catch(() => null);
        if (!bytes) return NextResponse.json({ message: 'Report file is missing' }, { status: 404 });

        await auditAccess(user, { action: 'DOWNLOAD', entity: 'LAB_REPORT', entityId: requestId, patientId: report.patient_id });

        return new NextResponse(new Uint8Array(bytes), {
            headers: {
                'Content-Type': mimeForStoredName(report.result_file),
                'Content-Disposition': `inline; filename="lab-report-${requestId}.${report.result_file.split('.').pop()}"`,
                'X-Content-Type-Options': 'nosniff',
                'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
                'Cache-Control': 'private, no-store',
            },
        });
    } catch (error) {
        console.error('Lab Report Download Error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
