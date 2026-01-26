
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';
import { writeFile } from 'fs/promises';
import { join } from 'path';

// POST Upload Result
export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        const user = await AuthService.verifyToken(token || '');
        if (!user || user.role !== 'LAB_ASSISTANT') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const formData = await req.formData();
        const file = formData.get('file') as File;
        const requestId = formData.get('requestId') as string;

        if (!file || !requestId) {
            return NextResponse.json({ message: 'Missing file or request ID' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        // Save file locally (In production, use S3/Cloud Storage)
        const filename = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
        const uploadDir = join(process.cwd(), 'public', 'uploads', 'lab-reports');
        const filepath = join(uploadDir, filename);

        // Ensure directory exists (node 10+ handles with recursive param, but usually good to check)
        // For simplicity assuming public/uploads/lab-reports exists or handled by deploy script. 
        // Let's rely on basic fs, possibly needing mkdir.
        const fs = require('fs');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        await writeFile(filepath, buffer);
        const fileUrl = `/uploads/lab-reports/${filename}`;

        // Update Database
        await query(
            `UPDATE lab_requests SET status = 'COMPLETED', result_url = ?, completed_at = NOW() WHERE id = ?`,
            [fileUrl, requestId]
        );

        return NextResponse.json({ message: 'Result Uploaded Successfully', url: fileUrl });

    } catch (error) {
        console.error('Upload Error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
