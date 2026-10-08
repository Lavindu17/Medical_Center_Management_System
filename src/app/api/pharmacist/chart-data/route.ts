import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireRole } from '@/lib/api-auth';

const DAYS = 30;

export async function GET() {
    const auth = await requireRole('PHARMACIST');
    if ('error' in auth) return auth.error;

    try {
        // 1. Daily dispensing trend for the last 30 days (today and the 29 days before it).
        //    Days are keyed as text by MySQL so no time-zone conversion can shift a payment onto the wrong day,
        //    and revenue is what was actually charged for the dispensed part of each item.
        const dailyRows = await query<any[]>(`
            SELECT
                DATE_FORMAT(b.paid_at, '%Y-%m-%d') AS date,
                COALESCE(SUM(pi.dispensed_quantity), 0) AS quantity_dispensed,
                COALESCE(SUM(pi.dispensed_amount), 0) AS revenue
            FROM prescription_items pi
            JOIN prescriptions pr ON pr.id = pi.prescription_id
            JOIN bills b ON b.appointment_id = pr.appointment_id
            WHERE pi.dispensed_quantity > 0
              AND b.status = 'PAID'
              AND b.paid_at >= DATE_SUB(CURDATE(), INTERVAL ${DAYS - 1} DAY)
            GROUP BY DATE_FORMAT(b.paid_at, '%Y-%m-%d')
            ORDER BY date ASC
        `);

        const lastDays: { date: string; label: string; quantity: number; revenue: number }[] = [];
        const today = new Date();
        for (let i = DAYS - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            lastDays.push({
                date: d.toLocaleDateString('en-CA'),            // local calendar day, YYYY-MM-DD
                label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                quantity: 0,
                revenue: 0,
            });
        }

        for (const row of dailyRows) {
            const target = lastDays.find(d => d.date === row.date);
            if (target) {
                target.quantity = Number(row.quantity_dispensed);
                target.revenue = Number(row.revenue);
            }
        }

        // 2. Inventory valuation
        const inventoryRows = await query<any[]>(`
            SELECT
                COALESCE(SUM(CASE WHEN expiry_date >= CURDATE() THEN quantity_current * buying_price ELSE 0 END), 0) AS asset_value,
                COALESCE(SUM(CASE WHEN expiry_date < CURDATE() AND quantity_current > 0 THEN quantity_current * buying_price ELSE 0 END), 0) AS write_off_value
            FROM inventory_batches
        `);

        // 3. Top categories by revenue (all time), again from what was actually charged
        const categoryRows = await query<any[]>(`
            SELECT
                COALESCE(m.category, 'Uncategorized') AS name,
                COALESCE(SUM(pi.dispensed_amount), 0) AS value
            FROM prescription_items pi
            JOIN medicines m ON m.id = pi.medicine_id
            JOIN prescriptions pr ON pr.id = pi.prescription_id
            JOIN bills b ON b.appointment_id = pr.appointment_id
            WHERE pi.dispensed_quantity > 0
              AND b.status = 'PAID'
            GROUP BY COALESCE(m.category, 'Uncategorized')
            ORDER BY value DESC
            LIMIT 5
        `);

        return NextResponse.json({
            dailyTrend: lastDays,
            inventory: {
                assetValue: Number(inventoryRows[0].asset_value),
                writeOffValue: Number(inventoryRows[0].write_off_value)
            },
            categories: categoryRows.map((r) => ({ name: r.name, value: Number(r.value) }))
        });

    } catch (error) {
        console.error('Pharmacist Chart API Error:', error);
        return NextResponse.json({ message: 'Error fetching chart data' }, { status: 500 });
    }
}
