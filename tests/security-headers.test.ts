import { describe, it, expect } from 'vitest';
import nextConfig from '../next.config';

describe('security headers', () => {
    it('are applied to every route', async () => {
        const rules = await nextConfig.headers!();
        expect(rules).toHaveLength(1);
        expect(rules[0].source).toBe('/:path*');
        const h = Object.fromEntries(rules[0].headers.map((x) => [x.key, x.value]));
        expect(h['X-Content-Type-Options']).toBe('nosniff');
        expect(h['X-Frame-Options']).toBe('DENY');
        expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
        expect(h['Permissions-Policy']).toMatch(/camera=\(\)/);
    });

    it('does not advertise the framework', () => {
        expect(nextConfig.poweredByHeader).toBe(false);
    });
});
