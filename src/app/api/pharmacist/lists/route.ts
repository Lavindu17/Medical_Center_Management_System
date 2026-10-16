import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { loadSettings } from '@/lib/hr';
import { addDays, localDay } from '@/lib/hr-time';
import { dayLabel, recentDays } from '@/lib/dashboard-range';

/** The pharmacy dashboard's working lists: what is about to expire, what is running low, what sells most, and how busy the queue is. */
export async function GET() {
    const auth = await requirePermission('pharmacy.dashboard', 'view');
    if ('error' in auth) return auth.error;

    try {
        const today = localDay(new Date(), (await loadSettings()).timezone);
        const days = recentDays(today, 14);

        const [expiring, low, top, issued] = await Promise.all([
            query<any[]>(
                `SELECT m.name, b.batch_number, b.quantity_current AS quantity, DATE_FORMAT(b.expiry_date, '%Y-%m-%d') AS expiry,
                        DATEDIFF(b.expiry_date, CURDATE()) AS days_left
                 FROM inventory_batches b JOIN medicines m ON m.id = b.medicine_id
                 WHERE b.quantity_current > 0 AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                 ORDER BY b.expiry_date, m.name LIMIT 5`),
            query<any[]>(
                `SELECT name, stock, COALESCE(min_stock_level, 20) AS minimum FROM medicines
                 WHERE stock < COALESCE(min_stock_level, 20) ORDER BY stock, name LIMIT 5`),
            query<any[]>(
                `SELECT m.name, SUM(pi.dispensed_quantity) AS value
                 FROM prescription_items pi JOIN medicines m ON m.id = pi.medicine_id JOIN prescriptions pr ON pr.id = pi.prescription_id
                 WHERE pi.dispensed_quantity > 0 AND DATE_FORMAT(pr.issued_at, '%Y-%m-%d') >= ?
                 GROUP BY m.id, m.name ORDER BY value DESC, m.name LIMIT 5`, [addDays(today, -29)]),
            query<any[]>(
                `SELECT DATE_FORMAT(issued_at, '%Y-%m-%d') AS day, COUNT(*) AS issued FROM prescriptions
                 WHERE DATE_FORMAT(issued_at, '%Y-%m-%d') >= ? GROUP BY day`, [days[0]]),
        ]);

        return NextResponse.json({
            expiring: expiring.map((r) => ({ name: r.name, batch: r.batch_number, quantity: Number(r.quantity), expiry: r.expiry, daysLeft: Number(r.days_left) })),
            lowStock: low.map((r) => ({ name: r.name, stock: Number(r.stock), minimum: Number(r.minimum) })),
            topMedicines: top.map((r) => ({ name: r.name as string, value: Number(r.value) })),
            prescriptions: days.map((day) => ({ day, label: dayLabel(day), issued: Number(issued.find((r) => r.day === day)?.issued ?? 0) })),
        });
    } catch (error) {
        console.error('Pharmacist lists error:', error);
        return NextResponse.json({ message: 'Could not load the lists' }, { status: 500 });
    }
}
