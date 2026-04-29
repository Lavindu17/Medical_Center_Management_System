import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

export async function GET(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        const user = await AuthService.verifyToken(token || '');
        if (!user || user.role !== 'PHARMACIST') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // 1. Daily Dispensing Trend (Last 30 Days)
        const dailyRows: any = await query(`
            SELECT
                DATE(b.paid_at) as date,
                COALESCE(SUM(pi.dispensed_quantity), 0) as quantity_dispensed,
                COALESCE(SUM(pi.dispensed_quantity * m.price_per_unit), 0) as revenue
            FROM prescription_items pi
            JOIN medicines m ON m.id = pi.medicine_id
            JOIN prescriptions pr ON pr.id = pi.prescription_id
            JOIN bills b ON b.appointment_id = pr.appointment_id
            WHERE pi.status IN ('DISPENSED', 'PARTIALLY_COMPLETED')
              AND pi.dispensed_quantity > 0
              AND b.status = 'PAID'
              AND b.paid_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY DATE(b.paid_at)
            ORDER BY date ASC
        `);

        // Generate an array of the last 30 days including empty days
        const last30Days = [];
        const today = new Date();
        for (let i = 29; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            last30Days.push({
                date: d.toISOString().split('T')[0],
                label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                quantity: 0,
                revenue: 0,
            });
        }

        dailyRows.forEach((row: any) => {
            const dateStr = new Date(row.date).toISOString().split('T')[0];
            const target = last30Days.find(d => d.date === dateStr);
            if (target) {
                target.quantity = Number(row.quantity_dispensed);
                target.revenue = Number(row.revenue);
            }
        });

        // 2. Inventory Valuation
        const inventoryRows: any = await query(`
            SELECT
                COALESCE(SUM(CASE WHEN expiry_date >= CURDATE() THEN quantity_current * buying_price ELSE 0 END), 0) as asset_value,
                COALESCE(SUM(CASE WHEN expiry_date < CURDATE() AND quantity_current > 0 THEN quantity_current * buying_price ELSE 0 END), 0) as write_off_value
            FROM inventory_batches
        `);

        // 3. Top Categories by Revenue (All time or last 30 days?) Let's do all time to show general distribution
        const categoryRows: any = await query(`
            SELECT
                COALESCE(m.category, 'Uncategorized') as name,
                COALESCE(SUM(pi.dispensed_quantity * m.price_per_unit), 0) as value
            FROM prescription_items pi
            JOIN medicines m ON m.id = pi.medicine_id
            JOIN prescriptions pr ON pr.id = pi.prescription_id
            JOIN bills b ON b.appointment_id = pr.appointment_id
            WHERE pi.status IN ('DISPENSED', 'PARTIALLY_COMPLETED')
              AND pi.dispensed_quantity > 0
              AND b.status = 'PAID'
            GROUP BY m.category
            ORDER BY value DESC
            LIMIT 5
        `);

        return NextResponse.json({
            dailyTrend: last30Days,
            inventory: {
                assetValue: Number(inventoryRows[0].asset_value),
                writeOffValue: Number(inventoryRows[0].write_off_value)
            },
            categories: categoryRows.map((r: any) => ({ name: r.name, value: Number(r.value) }))
        });

    } catch (error) {
        console.error('Pharmacist Chart API Error:', error);
        return NextResponse.json({ message: 'Error fetching chart data' }, { status: 500 });
    }
}
