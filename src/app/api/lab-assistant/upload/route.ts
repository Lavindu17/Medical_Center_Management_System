import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { query } from '@/lib/db';
import { requireRole } from '@/lib/api-auth';
import { nameOf, notify } from '@/lib/notify';
import { MAX_REPORT_BYTES, detectReportType, reportDir } from '@/lib/lab-reports';

// POST Upload Result
export async function POST(req: Request) {
    const auth = await requireRole('LAB_ASSISTANT');
    if ('error' in auth) return auth.error;
    const { user } = auth;

    let storedPath: string | null = null;
    try {
        const formData = await req.formData().catch(() => null);
        const file = formData?.get('file');
        const requestId = Number(formData?.get('requestId'));

        if (!(file instanceof File) || !Number.isInteger(requestId) || requestId <= 0) {
            return NextResponse.json({ message: 'A report file and a valid request ID are required' }, { status: 400 });
        }
        if (file.size === 0) {
            return NextResponse.json({ message: 'The file is empty' }, { status: 400 });
        }
        if (file.size > MAX_REPORT_BYTES) {
            return NextResponse.json({ message: 'The file is too large (10 MB maximum)' }, { status: 413 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const type = detectReportType(buffer);
        if (!type) {
            return NextResponse.json({ message: 'Only PDF, PNG and JPEG reports are accepted' }, { status: 415 });
        }

        const requests = await query<any[]>(
            `SELECT lr.status AS lab_status, a.status AS appointment_status
             FROM lab_requests lr JOIN appointments a ON a.id = lr.appointment_id WHERE lr.id = ?`,
            [requestId]);
        if (requests.length === 0) {
            return NextResponse.json({ message: 'Lab request not found' }, { status: 404 });
        }
        if (requests[0].lab_status !== 'PENDING') {
            return NextResponse.json({ message: 'A result has already been uploaded for this request' }, { status: 409 });
        }
        if (requests[0].appointment_status === 'CANCELLED') {
            return NextResponse.json({ message: 'This appointment was cancelled' }, { status: 409 });
        }

        // The stored name is generated here; nothing from the client's filename reaches the file system.
        const storedName = `${requestId}-${randomUUID()}.${type.ext}`;
        const dir = reportDir();
        await mkdir(dir, { recursive: true });
        storedPath = path.join(dir, storedName);
        await writeFile(storedPath, buffer, { flag: 'wx' });

        // Atomic claim: only one concurrent upload can move the request out of PENDING.
        const result: any = await query(
            `UPDATE lab_requests
             SET status = 'COMPLETED', result_file = ?, result_url = ?, uploaded_by = ?, completed_at = NOW()
             WHERE id = ? AND status = 'PENDING'`,
            [storedName, `/api/lab-reports/${requestId}`, user.id, requestId]);
        if (result.affectedRows !== 1) {
            await unlink(storedPath).catch(() => {});
            return NextResponse.json({ message: 'A result has already been uploaded for this request' }, { status: 409 });
        }
        storedPath = null; // committed

        const [who] = await query<any[]>(
            `SELECT a.patient_id, a.doctor_id, lt.name AS test_name FROM lab_requests lr
             JOIN appointments a ON a.id = lr.appointment_id JOIN lab_tests lt ON lt.id = lr.test_id WHERE lr.id = ?`, [requestId]);
        if (who) {
            await notify(null, who.doctor_id, {
                type: 'LAB_RESULT', title: 'Lab result available',
                body: `The ${who.test_name} result for ${await nameOf(null, who.patient_id)} is ready.`, link: '/doctor/appointments',
            });
            await notify(null, who.patient_id, {
                type: 'LAB_RESULT', title: 'Lab result available',
                body: `Your ${who.test_name} result is ready to view.`, link: '/patient/labs',
            });
        }

        return NextResponse.json({ message: 'Result Uploaded Successfully', url: `/api/lab-reports/${requestId}` });
    } catch (error) {
        if (storedPath) await unlink(storedPath).catch(() => {});
        console.error('Upload Error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
