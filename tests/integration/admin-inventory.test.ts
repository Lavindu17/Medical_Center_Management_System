import { describe, it, expect, afterAll } from 'vitest';
import { pool, query } from '@/lib/db';
import { DOCTOR, ALICE, PHARMACIST, as, post, ctx, isoDate, one, rows, addMedicine, makeAppointment, consult, rx } from './helpers';

// Plan sections 7 and 9: pharmacy inventory validation and admin user management.

afterAll(async () => { await pool.end(); });

const ADMIN = 1;
let n = 0;
const uniq = (label: string) => `${label}-${Date.now()}-${n++}`;

describe('medicine registration', () => {
    const create = async (body: Record<string, unknown>) => {
        await as('PHARMACIST', PHARMACIST);
        const { POST } = await import('@/app/api/pharmacist/inventory/route');
        return POST(post('/x', { unit: 'tablets', price_per_unit: 5, ...body }));
    };

    it('registers a medicine with zero stock and a placeholder expiry', async () => {
        const name = uniq('Newmed');
        const res = await create({ name, strength: '250mg', dosage_form: 'CAPSULE', min_stock_level: 0 });
        expect(res.status).toBe(201);
        const { id } = await res.json();
        expect(await one(`SELECT stock, min_stock_level, dosage_form, strength FROM medicines WHERE id = ?`, [id]))
            .toMatchObject({ stock: 0, min_stock_level: 0, dosage_form: 'CAPSULE', strength: '250mg' });   // 0 is a real threshold
    });

    it('treats blank optional fields as empty and defaults the threshold to 10', async () => {
        const res = await create({ name: uniq('Blanks'), generic_name: '', dosage_form: '', strength: '', min_stock_level: '' });
        expect(res.status).toBe(201);
        const row = await one(`SELECT generic_name, dosage_form, min_stock_level FROM medicines WHERE id = ?`, [(await res.json()).id]);
        expect(row).toEqual({ generic_name: null, dosage_form: null, min_stock_level: 10 });
    });

    it.each([
        ['missing name', { name: '' }],
        ['negative price', { price_per_unit: -1 }],
        ['non-numeric price', { price_per_unit: 'cheap' }],
        ['missing unit', { unit: '' }],
        ['unknown dosage form', { dosage_form: 'GAS' }],
        ['negative threshold', { min_stock_level: -4 }],
        ['fractional threshold', { min_stock_level: 2.5 }],
    ])('rejects %s', async (_l, over) => {
        expect((await create({ name: uniq('Bad'), ...over })).status).toBe(400);
    });

    it('allows a free medicine (price 0) but not a duplicate name+strength', async () => {
        const name = uniq('Dup');
        expect((await create({ name, price_per_unit: 0, strength: '5mg' })).status).toBe(201);
        expect((await create({ name: name.toUpperCase(), strength: '5mg' })).status).toBe(409);
        expect((await create({ name, strength: '10mg' })).status).toBe(201);   // a different strength is a different product
    });
});

describe('medicine edit and delete', () => {
    const put = async (id: number | string, body: Record<string, unknown>) => {
        await as('PHARMACIST', PHARMACIST);
        const { PUT } = await import('@/app/api/pharmacist/inventory/[id]/route');
        return PUT(post('/x', body, 'PUT'), ctx(id));
    };
    const del = async (id: number | string) => {
        await as('PHARMACIST', PHARMACIST);
        const { DELETE } = await import('@/app/api/pharmacist/inventory/[id]/route');
        return DELETE(new Request('http://x', { method: 'DELETE' }), ctx(id));
    };

    it('edits master data without touching stock or batches', async () => {
        const id = await addMedicine(uniq('Editme'), [{ qty: 30, expiryDays: 100, sell: 4 }]);
        const res = await put(id, { name: uniq('Renamed'), unit: 'tablets', price_per_unit: 9.5, min_stock_level: 3, stock: 99999, expiry_date: '2000-01-01' });
        expect(res.status).toBe(200);
        const m = await one(`SELECT stock, price_per_unit, min_stock_level FROM medicines WHERE id = ?`, [id]);
        expect(m).toMatchObject({ stock: 30, min_stock_level: 3 });
        expect(Number(m.price_per_unit)).toBe(9.5);
        expect((await one(`SELECT quantity_current FROM inventory_batches WHERE medicine_id = ?`, [id])).quantity_current).toBe(30);
    });

    it('validates the id and the body, and 404s for unknown medicines', async () => {
        expect((await put('abc', { name: 'x', unit: 'u', price_per_unit: 1 })).status).toBe(400);
        expect((await put(999999, { name: 'x', unit: 'u', price_per_unit: 1 })).status).toBe(404);
        const id = await addMedicine(uniq('Valid'), []);
        expect((await put(id, { name: 'x', unit: 'u', price_per_unit: -3 })).status).toBe(400);
        expect((await put(id, {})).status).toBe(400);
    });

    it('cannot rename onto another medicine', async () => {
        const a = uniq('Taken'); await addMedicine(a, []);
        const id = await addMedicine(uniq('Other'), []);
        expect((await put(id, { name: a, unit: 'tablets', price_per_unit: 1 })).status).toBe(409);
    });

    it('deletes an unused medicine with no stock, and says so for unknown ids', async () => {
        const id = await addMedicine(uniq('Gone'), []);
        expect((await del(id)).status).toBe(200);
        expect(await rows(`SELECT id FROM medicines WHERE id = ?`, [id])).toHaveLength(0);
        expect((await del(id)).status).toBe(404);
        expect((await del('abc')).status).toBe(400);
    });

    it('refuses to delete a medicine that still has stock (batch history would be lost)', async () => {
        const id = await addMedicine(uniq('Stocked'), [{ qty: 5, expiryDays: 100, sell: 1 }]);
        const res = await del(id);
        expect(res.status).toBe(409);
        expect(await rows(`SELECT id FROM inventory_batches WHERE medicine_id = ?`, [id])).toHaveLength(1);
    });

    it('refuses to delete a medicine on a prescription, with a clear message', async () => {
        const id = await addMedicine(uniq('Prescribed'), []);
        const appt = await makeAppointment();
        await consult(appt, { status: 'ONGOING', prescription: rx(id, 2) });
        const res = await del(id);
        expect(res.status).toBe(409);
        expect((await res.json()).error).toMatch(/prescriptions/i);
    });
});

describe('stock batches', () => {
    const addBatch = async (body: Record<string, unknown>) => {
        await as('PHARMACIST', PHARMACIST);
        const { POST } = await import('@/app/api/pharmacist/inventory/batch/route');
        return POST(post('/x', body));
    };
    const future = (days = 90) => isoDate(days);

    it('adds a batch, raises stock by the quantity and defaults the price to the list price', async () => {
        const id = await addMedicine(uniq('Batchy'), []);
        await query(`UPDATE medicines SET price_per_unit = 12 WHERE id = ?`, [id]);
        const res = await addBatch({ medicine_id: id, quantity: 25, expiry_date: future() });
        expect(res.status).toBe(201);
        expect((await one(`SELECT stock FROM medicines WHERE id = ?`, [id])).stock).toBe(25);
        const b = await one(`SELECT quantity_initial, quantity_current, selling_price, status, batch_number FROM inventory_batches WHERE medicine_id = ?`, [id]);
        expect(b).toMatchObject({ quantity_initial: 25, quantity_current: 25, status: 'ACTIVE' });
        expect(Number(b.selling_price)).toBe(12);          // never a free batch by accident
        expect(b.batch_number).toMatch(/^BATCH-/);
    });

    it('rejects zero, negative, fractional and non-numeric quantities without changing stock', async () => {
        const id = await addMedicine(uniq('Qty'), []);
        for (const quantity of [0, -5, 2.5, 'lots', null, undefined]) {
            expect((await addBatch({ medicine_id: id, quantity, expiry_date: future() })).status, String(quantity)).toBe(400);
        }
        expect((await one(`SELECT stock FROM medicines WHERE id = ?`, [id])).stock).toBe(0);
        expect(await rows(`SELECT id FROM inventory_batches WHERE medicine_id = ?`, [id])).toHaveLength(0);
    });

    it('rejects expiry dates that are today, past, malformed or impossible', async () => {
        const id = await addMedicine(uniq('Expiry'), []);
        for (const expiry_date of [isoDate(0), isoDate(-1), '2030-02-30', 'soon', '', '13/01/2030']) {
            expect((await addBatch({ medicine_id: id, quantity: 1, expiry_date })).status, expiry_date).toBe(400);
        }
        expect((await addBatch({ medicine_id: id, quantity: 1, expiry_date: isoDate(1) })).status).toBe(201);   // tomorrow is fine
    });

    it('rejects negative prices and unknown medicines', async () => {
        const id = await addMedicine(uniq('Price'), []);
        expect((await addBatch({ medicine_id: id, quantity: 1, expiry_date: future(), buying_price: -1 })).status).toBe(400);
        expect((await addBatch({ medicine_id: id, quantity: 1, expiry_date: future(), selling_price: -1 })).status).toBe(400);
        expect((await addBatch({ medicine_id: 999999, quantity: 1, expiry_date: future() })).status).toBe(404);
        expect((await addBatch({ quantity: 1, expiry_date: future() })).status).toBe(400);
    });

    it('does not allow the same batch number twice for one medicine', async () => {
        const id = await addMedicine(uniq('Lot'), []);
        expect((await addBatch({ medicine_id: id, batch_number: 'LOT-1', quantity: 5, expiry_date: future() })).status).toBe(201);
        expect((await addBatch({ medicine_id: id, batch_number: 'LOT-1', quantity: 5, expiry_date: future() })).status).toBe(409);
        expect((await one(`SELECT stock FROM medicines WHERE id = ?`, [id])).stock).toBe(5);
    });

    it('simultaneous deliveries are all counted', async () => {
        const id = await addMedicine(uniq('Rush'), []);
        const { POST } = await import('@/app/api/pharmacist/inventory/batch/route');
        const { identity } = await import('../helpers/state');
        const { tokenFor } = await import('../helpers/auth');
        const token = await tokenFor('PHARMACIST', PHARMACIST);
        const res = await Promise.all(Array.from({ length: 8 }, (_, i) => identity.run(token, () =>
            POST(post('/x', { medicine_id: id, batch_number: `RUSH-${i}`, quantity: 10, expiry_date: future() })))));
        expect(res.every((r) => r.status === 201)).toBe(true);
        expect((await one(`SELECT stock FROM medicines WHERE id = ?`, [id])).stock).toBe(80);
        expect((await one(`SELECT SUM(quantity_current) AS s FROM inventory_batches WHERE medicine_id = ?`, [id])).s).toBe('80');
    });

    it('lists batches soonest-expiring first and validates the id', async () => {
        const id = await addMedicine(uniq('List'), [{ qty: 5, expiryDays: 300, sell: 1 }, { qty: 5, expiryDays: 30, sell: 1 }]);
        await as('PHARMACIST', PHARMACIST);
        const { GET } = await import('@/app/api/pharmacist/inventory/batch/route');
        const list: any[] = await (await GET(new Request(`http://x/api/pharmacist/inventory/batch?medicineId=${id}`))).json();
        expect(list.map((b) => b.days_until_expiry)).toEqual([...list.map((b) => b.days_until_expiry)].sort((a, b) => a - b));
        expect((await GET(new Request('http://x/api/pharmacist/inventory/batch?medicineId=abc'))).status).toBe(400);
        expect((await GET(new Request('http://x/api/pharmacist/inventory/batch'))).status).toBe(400);
    });
});

describe('inventory list and alerts report numbers, not strings', () => {
    it('stock is numeric even for medicines with no batches', async () => {
        const empty = await addMedicine(uniq('Empty'), []);
        await as('PHARMACIST', PHARMACIST);
        const { GET } = await import('@/app/api/pharmacist/inventory/route');
        const list: any[] = await (await GET()).json();
        const row = list.find((m) => m.id === empty);
        expect(row.batch_stock).toBe(0);
        expect(typeof row.batch_stock).toBe('number');
    });

    it('low-stock alerts carry numeric current_stock', async () => {
        const low = await addMedicine(uniq('Low'), [{ qty: 2, expiryDays: 200, sell: 1 }]);
        await query(`UPDATE medicines SET min_stock_level = 10 WHERE id = ?`, [low]);
        await as('PHARMACIST', PHARMACIST);
        const { GET } = await import('@/app/api/pharmacist/alerts/route');
        const body = await (await GET()).json();
        const hit = body.lowStock.find((m: any) => m.medicine_id === low);
        expect(hit.current_stock).toBe(2);
    });
});

describe('admin: managing users', () => {
    const asAdmin = () => as('ADMIN', ADMIN);
    const createUser = async (body: Record<string, unknown>) => {
        await asAdmin();
        const { POST } = await import('@/app/api/users/route');
        return POST(post('/x', body));
    };
    const updateUser = async (body: Record<string, unknown>) => {
        await asAdmin();
        const { PUT } = await import('@/app/api/users/route');
        return PUT(post('/x', body, 'PUT'));
    };
    const deleteUser = async (id: unknown) => {
        await asAdmin();
        const { DELETE } = await import('@/app/api/users/route');
        return DELETE(new Request(`http://x/api/users?id=${id}`, { method: 'DELETE' }));
    };
    const newStaff = async (role = 'PHARMACIST', extra: Record<string, unknown> = {}) => {
        const email = `${uniq('staff')}@admin-test.local`;
        const res = await createUser({ name: 'Staff Person', email, password: 'Staff-Pass-1', role, ...extra });
        return { res, email };
    };

    it('staff created by an admin are verified and can sign in straight away', async () => {
        const { res, email } = await newStaff();
        expect(res.status).toBe(201);
        await query('DELETE FROM rate_limits');
        const { POST } = await import('@/app/api/auth/login/route');
        expect((await POST(post('/x', { email, password: 'Staff-Pass-1' }))).status).toBe(200);
    });

    it('doctors need a specialization and licence (400, not 500) and get a doctor profile when complete', async () => {
        expect((await newStaff('DOCTOR')).res.status).toBe(400);
        const { res, email } = await newStaff('DOCTOR', { specialization: 'Cardiologist', licenseNumber: uniq('LIC') });
        expect(res.status).toBe(201);
        expect(await one(`SELECT d.user_id FROM doctors d JOIN users u ON u.id = d.user_id WHERE u.email = ?`, [email])).toBeTruthy();
    });

    it('rejects a duplicate email and cannot create patients or invalid roles', async () => {
        const { email } = await newStaff();
        expect((await createUser({ name: 'Dup', email, password: 'Staff-Pass-1', role: 'PHARMACIST' })).status).toBe(409);
        expect((await newStaff('PATIENT')).res.status).toBe(400);
        expect((await newStaff('SUPERUSER')).res.status).toBe(400);
        expect((await createUser({ name: 'X', email: 'bad', password: '123', role: 'ADMIN' })).status).toBe(400);
    });

    it('edits name, email and phone but refuses duplicate emails and unknown users', async () => {
        const a = await newStaff(), b = await newStaff();
        const idA = (await one(`SELECT id FROM users WHERE email = ?`, [a.email])).id;
        expect((await updateUser({ id: idA, name: 'Renamed Person', email: a.email, role: 'PHARMACIST', phone: '0770000000' })).status).toBe(200);
        expect((await updateUser({ id: idA, name: 'Renamed Person', email: b.email, role: 'PHARMACIST' })).status).toBe(409);
        expect((await updateUser({ id: 999999, name: 'Ghost', email: 'ghost@x.co', role: 'PHARMACIST' })).status).toBe(404);
    });

    it('does not allow roles to move to or from Doctor/Patient, but staff-to-staff is fine', async () => {
        const staff = await newStaff();
        const id = (await one(`SELECT id FROM users WHERE email = ?`, [staff.email])).id;
        expect((await updateUser({ id, name: 'Staff Person', email: staff.email, role: 'DOCTOR' })).status).toBe(400);
        expect((await updateUser({ id, name: 'Staff Person', email: staff.email, role: 'RECEPTIONIST' })).status).toBe(200);
        expect((await updateUser({ id: DOCTOR, name: 'Dr. John Smith', email: 'doc.smith@sethro.com', role: 'PHARMACIST' })).status).toBe(400);
        expect((await updateUser({ id: ALICE, name: 'Alice Cooper', email: 'patient.alice@gmail.com', role: 'ADMIN' })).status).toBe(400);
    });

    it('delete: unknown id, bad id, own account', async () => {
        expect((await deleteUser(999999)).status).toBe(404);
        expect((await deleteUser('abc')).status).toBe(400);
        expect((await deleteUser(0)).status).toBe(400);
        expect((await deleteUser(ADMIN)).status).toBe(400);
    });

    it('deletes unused staff but explains why a user with medical records cannot be deleted', async () => {
        const staff = await newStaff();
        const id = (await one(`SELECT id FROM users WHERE email = ?`, [staff.email])).id;
        expect((await deleteUser(id)).status).toBe(200);
        const res = await deleteUser(DOCTOR);       // has appointments
        expect(res.status).toBe(409);
        expect((await res.json()).message).toMatch(/cannot be deleted/i);
        expect(await one(`SELECT id FROM users WHERE id = ?`, [DOCTOR])).toBeTruthy();
    });
});

describe('admin: doctor fees and revenue', () => {
    it('updates fee and commission, 404s for unknown doctors, and rejects out-of-range values', async () => {
        await as('ADMIN', ADMIN);
        const { PUT } = await import('@/app/api/admin/doctors/route');
        const put = (body: unknown) => PUT(post('/x', body, 'PUT'));
        expect((await put({ id: 3, consultationFee: 2100, commissionRate: 90 })).status).toBe(200);
        expect(Number((await one(`SELECT consultation_fee FROM doctors WHERE user_id = 3`)).consultation_fee)).toBe(2100);
        await put({ id: 3, consultationFee: 2000, commissionRate: 100 });
        expect((await put({ id: 999999, consultationFee: 1, commissionRate: 1 })).status).toBe(404);
        expect((await put({ id: 3, consultationFee: -1, commissionRate: 10 })).status).toBe(400);
        expect((await put({ id: 3, consultationFee: 10, commissionRate: 100.01 })).status).toBe(400);
        expect((await put({ id: 3, consultationFee: 'free', commissionRate: 10 })).status).toBe(400);
    });

    it('revenue: bad month/year are a 400, valid ones are 200', async () => {
        await as('ADMIN', ADMIN);
        const { GET } = await import('@/app/api/admin/revenue/route');
        for (const qs of ['month=abc', 'month=0', 'month=13', 'year=1999', 'year=2101', 'year=x']) {
            expect((await GET(new Request('http://x/api/admin/revenue?' + qs))).status, qs).toBe(400);
        }
        expect((await GET(new Request('http://x/api/admin/revenue?month=1&year=2026'))).status).toBe(200);
        expect((await GET(new Request('http://x/api/admin/revenue'))).status).toBe(200);
    });

    it('dashboard stats count patients, staff and today\'s bookings', async () => {
        await as('ADMIN', ADMIN);
        const { GET } = await import('@/app/api/admin/dashboard-stats/route');
        const body = await (await GET()).json();
        expect(body.patients).toBeGreaterThanOrEqual(2);
        expect(body.staff).toBeGreaterThanOrEqual(6);
        expect(typeof body.revenue).toBe('number');
        expect(typeof body.todayAppointments).toBe('number');
    });
});
