import { describe, it, expect } from 'vitest';
import { GET, POST } from '@/app/api/auth/logout/route';

const get = (headers: Record<string, string> = {}) => GET(new Request('http://localhost/api/auth/logout', { headers }));

describe('logout', () => {
    it.each(['same-origin', 'none'])('signs out a request the browser marks %s and goes to the login page', async (site) => {
        const res = await get({ 'sec-fetch-site': site });
        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toBe('http://localhost/login');
    });

    it('also works for clients that send no fetch metadata (tools, older browsers)', async () => {
        expect((await get()).status).toBe(307);
    });

    it.each(['cross-site', 'same-site'])('refuses a %s request, so another website cannot sign users out', async (site) => {
        const res = await get({ 'sec-fetch-site': site });
        expect(res.status).toBe(403);
        expect(res.headers.get('location')).toBeNull();
    });

    it('POST signs out', async () => {
        const res = await POST();
        expect(res.status).toBe(200);
    });
});
