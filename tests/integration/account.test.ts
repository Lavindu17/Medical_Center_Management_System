import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { pool } from '@/lib/db';
import { state } from '../helpers/state';
import { as, post, one, ALICE, RECEPTIONIST, PHARMACIST } from './helpers';

// One Account endpoint serves every role: own name and phone only, email stays read-only.

afterAll(async () => { await pool.end(); });
beforeEach(() => { state.token = null; });

const get = async () => (await import('@/app/api/account/route')).GET();
const put = async (body: unknown) => (await import('@/app/api/account/route')).PUT(post('/api/account', body, 'PUT'));

describe('/api/account', () => {
    it('requires a signed-in user', async () => {
        expect((await get()).status).toBe(401);
        expect((await put({ name: 'Nobody' })).status).toBe(401);
    });

    it.each([['PATIENT', ALICE], ['RECEPTIONIST', RECEPTIONIST], ['PHARMACIST', PHARMACIST]] as const)(
        'lets a %s read and update their own name and phone', async (role, id) => {
            await as(role, id);
            const before = (await (await get()).json()).account;
            expect(before.email).toContain('@');

            const res = await put({ name: 'Renamed Person', phone: '+94 77 123 4567' });
            expect(res.status).toBe(200);
            const row = await one('SELECT name, phone, email FROM users WHERE id = ?', [id]);
            expect(row).toMatchObject({ name: 'Renamed Person', phone: '+94 77 123 4567', email: before.email });

            await put({ name: before.name, phone: before.phone ?? '' });   // put the seed data back
        });

    it('never changes email or role, even if they are sent', async () => {
        await as('PATIENT', ALICE);
        const before = await one('SELECT email, role FROM users WHERE id = ?', [ALICE]);
        await put({ name: 'Alice Same', email: 'hacker@evil.test', role: 'ADMIN' });
        expect(await one('SELECT email, role FROM users WHERE id = ?', [ALICE])).toEqual(before);
    });

    it('rejects a short name and a bad phone with the offending field', async () => {
        await as('PATIENT', ALICE);
        const shortName = await put({ name: 'A' });
        expect(shortName.status).toBe(400);
        expect((await shortName.json()).field).toBe('name');

        const badPhone = await put({ name: 'Alice Fine', phone: 'call me' });
        expect(badPhone.status).toBe(400);
        expect((await badPhone.json()).field).toBe('phone');
    });
});
