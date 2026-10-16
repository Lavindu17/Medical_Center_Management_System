/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { RESOURCE_KEYS } from '@/lib/access/registry';
import { SCREENS, mayOpen, screenAt } from '@/lib/access/screens';
import { buildSeedSql } from '@/lib/access/seed';

// Every window in the staff app is a permission. A page that is not listed is closed to everyone, so a new page cannot be
// forgotten and left open.
const pages = Object.keys(import.meta.glob('../src/app/**/page.tsx')).filter((p) => p.includes('/(staff)/'));
const urlOf = (file: string) => '/' + file.replace('../src/app/(dashboard)/(staff)/', '').replace(/\/?page\.tsx$/, '').replace(/\[\w+\]/g, '1');

describe('every staff page is a screen', () => {
    for (const file of pages) {
        const url = urlOf(file);
        if (url === '/staff') continue;                 // the start page only redirects
        it(url, () => {
            const screen = screenAt(url);
            expect(screen, `${url} is not in the screen list (src/lib/access/screens.ts)`).not.toBeNull();
        });
    }
});

describe('every listed screen has a page and a real permission', () => {
    const urls = new Set(pages.map(urlOf));
    for (const s of SCREENS) {
        it(`${s.label} (${s.href})`, () => {
            expect(urls.has(s.href), `no page at ${s.href}`).toBe(true);
            expect(RESOURCE_KEYS).toContain(s.resource);
        });
    }
});

describe('every permission has a screen or is a widget of one', () => {
    const WIDGET_ONLY = ['lab.dashboard'];                // shown at the top of the lab requests page
    for (const key of RESOURCE_KEYS) {
        it(key, () => expect(WIDGET_ONLY.includes(key) || SCREENS.some((s) => s.resource === key)).toBe(true));
    }
});

describe('unlisted pages are closed', () => {
    it('a page that is not a screen opens for nobody', () => {
        const everything = Object.fromEntries(RESOURCE_KEYS.map((k) => [k, { view: true, add: true, change: true, approve: true }]));
        expect(mayOpen(everything, '/admin/secret-new-page')).toBe(false);
        expect(mayOpen(everything, '/doctor/work')).toBe(false);
    });
    it('the start page is open (it only redirects or says there is no access yet)', () => {
        expect(mayOpen({}, '/staff')).toBe(true);
    });
    it('a person with nothing opens nothing', () => {
        for (const s of SCREENS) expect(mayOpen({}, s.href), s.href).toBe(false);
    });
});

describe('the seed file matches the starting profiles', () => {
    it('23_access_seed.sql is what the starting profiles generate (run the generator if you changed them)', () => {
        const committed = fs.readFileSync('mydocumentations/databas_setup_querries/23_access_seed.sql', 'utf8').replace(/\r\n/g, '\n');
        expect(committed).toBe(buildSeedSql());
    });
});
