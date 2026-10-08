import { describe, it, expect, afterAll } from 'vitest';
import { pool, query } from '@/lib/db';
import { PHARMACIST, as, one, makeAppointment, addMedicine, consult, dispense, rx } from './helpers';

// Plan section 7: pharmacist dashboard numbers (stats and charts).
afterAll(async () => { await pool.end(); });

async function paidDispense(med: number, qty: number, paidDaysAgo: number) {
    const appt = await makeAppointment();
    await consult(appt, { status: 'COMPLETED', prescription: rx(med, qty) });
    const p = await one(`SELECT id FROM prescriptions WHERE appointment_id = ?`, [appt]);
    const item = await one(`SELECT id FROM prescription_items WHERE prescription_id = ?`, [p.id]);
    await dispense(p.id, { action: 'DISPENSE', quantity_to_dispense: qty, item_id: item.id });
    await query(`UPDATE bills SET status = 'PAID', paid_at = DATE_SUB(NOW(), INTERVAL ? DAY) WHERE appointment_id = ?`, [paidDaysAgo, appt]);
    return appt;
}

const chart = async () => {
    await as('PHARMACIST', PHARMACIST);
    const { GET } = await import('@/app/api/pharmacist/chart-data/route');
    return (await GET()).json();
};
const todayLocal = () => new Date().toLocaleDateString('en-CA');
const daysAgoLocal = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString('en-CA'); };

describe('pharmacist chart data', () => {
    it('always returns exactly 30 consecutive days ending today, in the local calendar', async () => {
        const { dailyTrend } = await chart();
        expect(dailyTrend).toHaveLength(30);
        expect(dailyTrend[29].date).toBe(todayLocal());
        expect(dailyTrend[0].date).toBe(daysAgoLocal(29));
        const dates = dailyTrend.map((d: any) => d.date);
        expect(new Set(dates).size).toBe(30);
        expect([...dates].sort()).toEqual(dates);
    });

    it('attributes a payment to the day it was paid, using the amount actually charged', async () => {
        const before = (await chart()).dailyTrend;
        const med = await addMedicine(`Chartium-${Date.now()}`, [{ qty: 100, expiryDays: 200, sell: 7 }]);
        await query(`UPDATE medicines SET price_per_unit = 99 WHERE id = ?`, [med]);          // list price differs from the batch price
        await paidDispense(med, 10, 0);
        const after = (await chart()).dailyTrend;
        const today = after[29], was = before[29];
        expect(today.quantity - was.quantity).toBe(10);
        expect(today.revenue - was.revenue).toBe(70);          // 10 x batch price 7, not 10 x list price 99
    });

    it('includes a payment 29 days ago but not one 30 days ago', async () => {
        const before = (await chart()).dailyTrend;
        const med = await addMedicine(`Edge-${Date.now()}`, [{ qty: 100, expiryDays: 200, sell: 3 }]);
        await paidDispense(med, 4, 29);
        await paidDispense(med, 6, 30);
        const after = (await chart()).dailyTrend;
        expect(after[0].quantity - before[0].quantity).toBe(4);       // day 29 is the first bucket
        expect(after.reduce((s: number, d: any) => s + d.quantity, 0) - before.reduce((s: number, d: any) => s + d.quantity, 0)).toBe(4);
    });

    it('ignores unpaid bills', async () => {
        const before = (await chart()).dailyTrend;
        const med = await addMedicine(`Unpaid-${Date.now()}`, [{ qty: 100, expiryDays: 200, sell: 3 }]);
        const appt = await paidDispense(med, 5, 0);
        await query(`UPDATE bills SET status = 'PENDING', paid_at = NULL WHERE appointment_id = ?`, [appt]);
        const after = (await chart()).dailyTrend;
        expect(after[29].quantity).toBe(before[29].quantity);
    });

    it('values inventory and flags expired stock as write-off', async () => {
        const live = await addMedicine(`Asset-${Date.now()}`, [{ qty: 10, expiryDays: 100, sell: 1 }]);
        const dead = await addMedicine(`Dead-${Date.now()}`, [{ qty: 5, expiryDays: -3, sell: 1 }]);
        await query(`UPDATE inventory_batches SET buying_price = 4 WHERE medicine_id IN (?, ?)`, [live, dead]);
        const { inventory } = await chart();
        expect(inventory.assetValue).toBeGreaterThanOrEqual(40);
        expect(inventory.writeOffValue).toBeGreaterThanOrEqual(20);
        expect(typeof inventory.assetValue).toBe('number');
    });

    it('lists categories by revenue with numeric values', async () => {
        const { categories } = await chart();
        expect(categories.length).toBeLessThanOrEqual(5);
        for (const c of categories) expect(typeof c.value).toBe('number');
        const values = categories.map((c: any) => c.value);
        expect([...values].sort((a: number, b: number) => b - a)).toEqual(values);
    });
});

describe('pharmacist stats', () => {
    it('returns numeric counts (this endpoint used to fail outright)', async () => {
        await as('PHARMACIST', PHARMACIST);
        const { GET } = await import('@/app/api/pharmacist/stats/route');
        const res = await GET(new Request('http://x'));
        expect(res.status).toBe(200);
        const body = await res.json();
        for (const key of ['pendingPrescriptions', 'lowStockCount', 'outOfStockCount', 'totalMedicines', 'expiredBatchesCount']) {
            expect(typeof body[key], key).toBe('number');
        }
        expect(body.totalMedicines).toBeGreaterThan(0);
    });

    it('counts pending prescriptions and expired batches that still hold stock', async () => {
        await as('PHARMACIST', PHARMACIST);
        const { GET } = await import('@/app/api/pharmacist/stats/route');
        const before = await (await GET(new Request('http://x'))).json();
        const med = await addMedicine(`Stats-${Date.now()}`, [{ qty: 5, expiryDays: -2, sell: 1 }]);
        const appt = await makeAppointment();
        await consult(appt, { status: 'ONGOING', prescription: rx(med, 1) });
        await as('PHARMACIST', PHARMACIST);          // consult() signed in as the doctor
        const after = await (await GET(new Request('http://x'))).json();
        expect(after.pendingPrescriptions).toBe(before.pendingPrescriptions + 1);
        expect(after.expiredBatchesCount).toBe(before.expiredBatchesCount + 1);
        expect(after.totalMedicines).toBe(before.totalMedicines + 1);
    });
});
