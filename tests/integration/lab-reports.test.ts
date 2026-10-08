import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pool, query } from '@/lib/db';
import { state, identity } from '../helpers/state';
import { tokenFor } from '../helpers/auth';
import { ALICE, BOB, DOCTOR, as, ctx, one, makeAppointment } from './helpers';

// Plan section 6: lab upload hardening and private report access.
const LAB_ASSISTANT = 7;
const UPLOAD_ROOT = path.join(os.tmpdir(), 'sethro-test-uploads', 'lab-reports');

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('rest-of-png')]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('rest-of-jpeg')]);

afterAll(async () => {
    fs.rmSync(path.join(os.tmpdir(), 'sethro-test-uploads'), { recursive: true, force: true });
    await pool.end();
});

async function labRequest(patient = ALICE, apptStatus = 'COMPLETED') {
    const appt = await makeAppointment(patient, apptStatus);
    const r: any = await query(`INSERT INTO lab_requests (appointment_id, test_id) VALUES (?, 1)`, [appt]);
    return { appt, id: r.insertId as number };
}

function form(fields: Record<string, string | Blob>, filename = 'report.pdf') {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) {
        if (v instanceof Blob) fd.append(k, v, filename); else fd.append(k, v);
    }
    return new Request('http://localhost/api/lab-assistant/upload', { method: 'POST', body: fd });
}

async function upload(requestId: number | string, content: Buffer, filename = 'report.pdf', type = 'application/pdf') {
    await as('LAB_ASSISTANT', LAB_ASSISTANT);
    const { POST } = await import('@/app/api/lab-assistant/upload/route');
    return POST(form({ file: new Blob([new Uint8Array(content)], { type }), requestId: String(requestId) }, filename));
}

async function download(id: number | string, role: Parameters<typeof as>[0], userId: number) {
    await as(role, userId);
    const { GET } = await import('@/app/api/lab-reports/[id]/route');
    return GET(new Request('http://localhost/api/lab-reports/' + id), ctx(id));
}

const storedFiles = () => (fs.existsSync(UPLOAD_ROOT) ? fs.readdirSync(UPLOAD_ROOT) : []);

describe('upload validation', () => {
    it('accepts PDF, PNG and JPEG and stores them privately under a generated name', async () => {
        for (const [content, ext] of [[PDF, 'pdf'], [PNG, 'png'], [JPG, 'jpg']] as const) {
            const { id } = await labRequest();
            const res = await upload(id, content, `scan.${ext}`);
            expect(res.status, ext).toBe(200);
            expect((await res.json()).url).toBe(`/api/lab-reports/${id}`);
            const row = await one(`SELECT status, result_file, result_url, uploaded_by, completed_at FROM lab_requests WHERE id = ?`, [id]);
            expect(row.status).toBe('COMPLETED');
            expect(row.result_file).toMatch(new RegExp(`^${id}-[0-9a-f-]{36}\\.${ext}$`));
            expect(row.result_url).toBe(`/api/lab-reports/${id}`);
            expect(row.uploaded_by).toBe(LAB_ASSISTANT);
            expect(row.completed_at).not.toBeNull();
            expect(fs.existsSync(path.join(UPLOAD_ROOT, row.result_file))).toBe(true);
            expect(fs.readFileSync(path.join(UPLOAD_ROOT, row.result_file))).toEqual(content);
        }
    });

    it('never writes into the public folder', async () => {
        const publicDir = path.join(process.cwd(), 'public', 'uploads', 'lab-reports');
        const before = fs.existsSync(publicDir) ? fs.readdirSync(publicDir).length : 0;
        const { id } = await labRequest();
        await upload(id, PDF);
        expect(fs.existsSync(publicDir) ? fs.readdirSync(publicDir).length : 0).toBe(before);
    });

    it.each([
        ['html', Buffer.from('<html><script>alert(document.cookie)</script></html>'), 'x.html', 'text/html'],
        ['svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'x.svg', 'image/svg+xml'],
        ['executable', Buffer.from('MZ\x90\x00\x03\x00\x00\x00'), 'x.exe', 'application/octet-stream'],
        ['script disguised as a PDF', Buffer.from('<?php system($_GET[1]); ?>'), 'x.pdf', 'application/pdf'],
        ['text', Buffer.from('just text'), 'x.png', 'image/png'],
    ])('rejects %s even when the name or MIME type claims otherwise', async (_label, content, name, type) => {
        const { id } = await labRequest();
        const before = storedFiles().length;
        const res = await upload(id, content, name, type);
        expect(res.status).toBe(415);
        expect(storedFiles().length).toBe(before);
        expect((await one(`SELECT status FROM lab_requests WHERE id = ?`, [id])).status).toBe('PENDING');
    });

    it('rejects an empty file and a file over 10 MB', async () => {
        const { id } = await labRequest();
        expect((await upload(id, Buffer.alloc(0))).status).toBe(400);
        const big = Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]);
        expect((await upload(id, big)).status).toBe(413);
        expect((await one(`SELECT status FROM lab_requests WHERE id = ?`, [id])).status).toBe('PENDING');
    });

    it('a hostile filename cannot influence where the file lands', async () => {
        const { id } = await labRequest();
        const res = await upload(id, PDF, '../../../../evil/../../x.pdf');
        expect(res.status).toBe(200);
        const { result_file } = await one(`SELECT result_file FROM lab_requests WHERE id = ?`, [id]);
        expect(path.basename(result_file)).toBe(result_file);
        expect(result_file).not.toContain('evil');
        expect(fs.existsSync(path.join(UPLOAD_ROOT, result_file))).toBe(true);
    });

    it('rejects missing or malformed form fields', async () => {
        await as('LAB_ASSISTANT', LAB_ASSISTANT);
        const { POST } = await import('@/app/api/lab-assistant/upload/route');
        const blob = new Blob([new Uint8Array(PDF)]);
        expect((await POST(form({ requestId: '1' }))).status).toBe(400);                              // no file
        expect((await POST(form({ file: 'not-a-file', requestId: '1' }))).status).toBe(400);          // text instead of file
        expect((await POST(form({ file: blob }))).status).toBe(400);                                  // no request id
        expect((await POST(form({ file: blob, requestId: 'abc' }))).status).toBe(400);
        expect((await POST(form({ file: blob, requestId: '-3' }))).status).toBe(400);
        expect((await POST(new Request('http://x', { method: 'POST', body: 'garbage' }))).status).toBe(400);
    });
});

describe('upload state rules', () => {
    it('unknown request ids are a 404 and leave no file behind', async () => {
        const before = storedFiles().length;
        expect((await upload(999999, PDF)).status).toBe(404);
        expect(storedFiles().length).toBe(before);
    });

    it('a request that already has a result cannot be overwritten', async () => {
        const { id } = await labRequest();
        expect((await upload(id, PDF)).status).toBe(200);
        const first = await one(`SELECT result_file FROM lab_requests WHERE id = ?`, [id]);
        const before = storedFiles().length;
        expect((await upload(id, PNG, 'again.png')).status).toBe(409);
        expect((await one(`SELECT result_file FROM lab_requests WHERE id = ?`, [id])).result_file).toBe(first.result_file);
        expect(storedFiles().length).toBe(before);
    });

    it('cannot attach a result to a cancelled appointment', async () => {
        const { id } = await labRequest(ALICE, 'CANCELLED');
        expect((await upload(id, PDF)).status).toBe(409);
    });

    it('simultaneous uploads for one request: exactly one wins and no file is orphaned', async () => {
        const { id } = await labRequest();
        const { POST } = await import('@/app/api/lab-assistant/upload/route');
        const token = await tokenFor('LAB_ASSISTANT', LAB_ASSISTANT);
        const before = storedFiles().length;
        const results = await Promise.all(Array.from({ length: 5 }, () => identity.run(token, () =>
            POST(form({ file: new Blob([new Uint8Array(PDF)]), requestId: String(id) })))));
        const codes = results.map((r) => r.status).sort();
        expect(codes.filter((c) => c === 200)).toHaveLength(1);
        expect(codes.filter((c) => c === 409)).toHaveLength(4);
        expect(storedFiles().length - before).toBe(1);
    });
});

describe('private report download', () => {
    let id: number;
    beforeAll(async () => {
        ({ id } = await labRequest(ALICE));      // appointment belongs to ALICE and doctor 2
        await upload(id, PDF);
    });

    it('is served to the patient it belongs to, with safe headers', async () => {
        const res = await download(id, 'PATIENT', ALICE);
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('application/pdf');
        expect(res.headers.get('x-content-type-options')).toBe('nosniff');
        expect(res.headers.get('content-security-policy')).toMatch(/sandbox/);
        expect(res.headers.get('cache-control')).toMatch(/no-store/);
        expect(Buffer.from(await res.arrayBuffer())).toEqual(PDF);
    });

    it('is served to the requesting doctor, the lab team and admins', async () => {
        expect((await download(id, 'DOCTOR', DOCTOR)).status).toBe(200);
        expect((await download(id, 'LAB_ASSISTANT', LAB_ASSISTANT)).status).toBe(200);
        expect((await download(id, 'ADMIN', 1)).status).toBe(200);
    });

    it('is refused to other patients and other doctors', async () => {
        expect((await download(id, 'PATIENT', BOB)).status).toBe(403);
        expect((await download(id, 'DOCTOR', 3)).status).toBe(403);
    });

    it('is refused to roles with no business with lab reports', async () => {
        for (const [role, uid] of [['PHARMACIST', 6], ['RECEPTIONIST', 8]] as const) {
            expect((await download(id, role, uid)).status, role).toBe(403);
        }
    });

    it('requires a session', async () => {
        state.token = null;
        const { GET } = await import('@/app/api/lab-reports/[id]/route');
        expect((await GET(new Request('http://x'), ctx(id))).status).toBe(401);
    });

    it('404s for unknown, pending and malformed ids and never reads outside the report folder', async () => {
        const pending = await labRequest(ALICE);
        expect((await download(pending.id, 'LAB_ASSISTANT', LAB_ASSISTANT)).status).toBe(404);
        expect((await download(999999, 'LAB_ASSISTANT', LAB_ASSISTANT)).status).toBe(404);
        expect((await download('abc', 'LAB_ASSISTANT', LAB_ASSISTANT)).status).toBe(400);
        // A tampered database value must not be followed out of the folder
        await query(`UPDATE lab_requests SET status = 'COMPLETED', result_file = '../../../etc/passwd' WHERE id = ?`, [pending.id]);
        expect((await download(pending.id, 'LAB_ASSISTANT', LAB_ASSISTANT)).status).toBe(404);
    });

    it('reports a missing file as 404 rather than crashing', async () => {
        const other = await labRequest(ALICE);
        await upload(other.id, PDF);
        const { result_file } = await one(`SELECT result_file FROM lab_requests WHERE id = ?`, [other.id]);
        fs.unlinkSync(path.join(UPLOAD_ROOT, result_file));
        expect((await download(other.id, 'PATIENT', ALICE)).status).toBe(404);
    });
});

describe('lab assistant request list', () => {
    it('includes the result link and hides requests for cancelled appointments', async () => {
        const done = await labRequest(ALICE);
        await upload(done.id, PDF);
        const hidden = await labRequest(ALICE, 'CANCELLED');
        await as('LAB_ASSISTANT', LAB_ASSISTANT);
        const { GET } = await import('@/app/api/lab-assistant/requests/route');
        const list: any[] = await (await GET(new Request('http://x'))).json();
        expect(list.find((r) => r.request_id === done.id)).toMatchObject({ status: 'COMPLETED', result_url: `/api/lab-reports/${done.id}` });
        expect(list.some((r) => r.request_id === hidden.id)).toBe(false);
    });
});
