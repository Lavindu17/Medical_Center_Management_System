import { clientIp } from '@/lib/audit-core';

/**
 * The caller's address, or null when it cannot be read. It comes from X-Forwarded-For / X-Real-IP, which are only
 * trustworthy behind a proxy that overwrites them (see the deployment notes), so it is used to slow abuse down, never to
 * grant access.
 */
export async function requestIp(): Promise<string | null> {
    try {
        const { headers } = await import('next/headers');
        return clientIp(await headers());
    } catch {
        return null;
    }
}
