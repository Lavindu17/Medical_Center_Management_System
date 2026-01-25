import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

async function checkAuth() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    const user = await AuthService.verifyToken(token || '');
    if (!user || user.role !== 'PHARMACIST') return false;
    return true;
}

export async function GET() {
    try {
        if (!await checkAuth()) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const today = new Date().toISOString().split('T')[0];
        const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const ninetyDaysFromNow = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const expiredBatches: any = await query(`
            SELECT 
                b.id as batch_id,
                b.batch_number,
                b.expiry_date,
                b.quantity_current,
                b.status,
                m.id as medicine_id,
                m.name as medicine_name,
                m.unit,
                DATEDIFF(?, b.expiry_date) as days_expired
            FROM inventory_batches b
            JOIN medicines m ON b.medicine_id = m.id
            WHERE b.expiry_date < ?
              AND b.quantity_current > 0
              AND b.status = 'ACTIVE'
            ORDER BY b.expiry_date ASC
        `, [today, today]);

        // 2. Batches Expiring Within 30 Days
        const expiringSoon: any = await query(`
            SELECT 
                b.id as batch_id,
                b.batch_number,
                b.expiry_date,
                b.quantity_current,
                b.status,
                m.id as medicine_id,
                m.name as medicine_name,
                m.unit,
                DATEDIFF(b.expiry_date, ?) as days_until_expiry
            FROM inventory_batches b
            JOIN medicines m ON b.medicine_id = m.id
            WHERE b.expiry_date >= ?
              AND b.expiry_date <= ?
              AND b.quantity_current > 0
              AND b.status = 'ACTIVE'
            ORDER BY b.expiry_date ASC
        `, [today, today, thirtyDaysFromNow]);

        // 3. Batches Expiring Within 31-90 Days
        const expiringLater: any = await query(`
            SELECT 
                b.id as batch_id,
                b.batch_number,
                b.expiry_date,
                b.quantity_current,
                b.status,
                m.id as medicine_id,
                m.name as medicine_name,
                m.unit,
                DATEDIFF(b.expiry_date, ?) as days_until_expiry
            FROM inventory_batches b
            JOIN medicines m ON b.medicine_id = m.id
            WHERE b.expiry_date > ?
              AND b.expiry_date <= ?
              AND b.quantity_current > 0
              AND b.status = 'ACTIVE'
            ORDER BY b.expiry_date ASC
        `, [today, thirtyDaysFromNow, ninetyDaysFromNow]);

        // 4. Medicines with Multiple Batches with Different Expiry Dates
        // Find medicines where the difference between earliest and latest expiry is > 90 days
        const multiBatchWarnings: any = await query(`
            SELECT 
                m.id as medicine_id,
                m.name as medicine_name,
                COUNT(b.id) as batch_count,
                MIN(b.expiry_date) as earliest_expiry,
                MAX(b.expiry_date) as latest_expiry,
                DATEDIFF(MAX(b.expiry_date), MIN(b.expiry_date)) as expiry_gap_days,
                SUM(b.quantity_current) as total_stock
            FROM medicines m
            JOIN inventory_batches b ON m.id = b.medicine_id
            WHERE b.quantity_current > 0
              AND b.status = 'ACTIVE'
            GROUP BY m.id
            HAVING batch_count > 1 AND expiry_gap_days > 90
            ORDER BY expiry_gap_days DESC
        `);

        return NextResponse.json({
            expired: expiredBatches,
            expiringSoon,
            expiringLater,
            multiBatchWarnings,
            summary: {
                expiredCount: (expiredBatches as any[]).length,
                expiringSoonCount: (expiringSoon as any[]).length,
                expiringLaterCount: (expiringLater as any[]).length,
                multiBatchWarningsCount: (multiBatchWarnings as any[]).length
            }
        });

    } catch (error) {
        console.error('Fetch Expiry Alerts Error:', error);
        return NextResponse.json({ message: 'Error fetching alerts' }, { status: 500 });
    }
}
