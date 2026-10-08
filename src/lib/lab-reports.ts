import path from 'path';

/** Lab reports live outside `public/` so they are only reachable through the authenticated download route. */
export const MAX_REPORT_BYTES = 10 * 1024 * 1024;

export function reportDir() {
    return process.env.UPLOAD_DIR
        ? path.resolve(process.env.UPLOAD_DIR, 'lab-reports')
        : path.join(process.cwd(), 'private-uploads', 'lab-reports');
}

export interface DetectedType { ext: 'pdf' | 'png' | 'jpg'; mime: string }

/** Identifies the real file type from its leading bytes. The client-supplied name and MIME type are never trusted. */
export function detectReportType(bytes: Uint8Array): DetectedType | null {
    const startsWith = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
    if (startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])) return { ext: 'pdf', mime: 'application/pdf' };       // %PDF-
    if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: 'png', mime: 'image/png' };
    if (startsWith([0xff, 0xd8, 0xff])) return { ext: 'jpg', mime: 'image/jpeg' };
    return null;
}

const MIME_BY_EXT: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg' };

/** Only filenames this module generated are ever read back (no path separators, fixed extensions). */
export function isSafeStoredName(name: string) {
    return /^[0-9]+-[0-9a-f-]{36}\.(pdf|png|jpg)$/.test(name);
}

export function mimeForStoredName(name: string) {
    return MIME_BY_EXT[name.split('.').pop() ?? ''] ?? 'application/octet-stream';
}
