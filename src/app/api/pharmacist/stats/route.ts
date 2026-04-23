import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

export async function GET(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        const user = await AuthService.verifyToken(token || '');
        if (!user || user.role !== 'PHARMACIST') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const today = new Date().toISOString().split('T')[0];
        const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // 1. Pending Prescriptions
        // 1. Pending Prescriptions (Include partially completed so they aren't hidden)
        const [pendingRows]: any = await query('SELECT COUNT(*) as count FROM prescriptions WHERE status IN ("PENDING", "PARTIALLY_COMPLETED")');

        // 2. Low Stock Medicines (Below min_stock_level or < 20 if not set) AND stock > 0
        const [lowStockRows]: any = await query(`
            SELECT COUNT(*) as count 
            FROM medicines 
            WHERE stock > 0 AND stock < COALESCE(min_stock_level, 20)
        `);

        // 2.5 Out of Stock 
        const [outOfStockRows]: any = await query(`
            SELECT COUNT(*) as count 
            FROM medicines 
            WHERE stock = 0
        `);

        // 3. Total Medicines
        const [totalMedRows]: any = await query('SELECT COUNT(*) as count FROM medicines');

        // 4. Expired Batches Count (Check anything with quantity > 0 and past expiry)
        const [expiredRows]: any = await query(`
            SELECT COUNT(*) as count 
            FROM inventory_batches 
            WHERE expiry_date < CURDATE() 
              AND quantity_current > 0 
        `);

        // 5. Expiring Soon (within 30 days)
        const [expiringSoonRows]: any = await query(`
            SELECT COUNT(*) as count 
            FROM inventory_batches 
            WHERE expiry_date >= CURDATE() 
              AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
              AND quantity_current > 0 
              AND status = 'ACTIVE'
        `);

        return NextResponse.json({
            pendingPrescriptions: pendingRows[0].count,
            lowStockCount: lowStockRows[0].count,
            outOfStockCount: outOfStockRows[0].count,
            totalMedicines: totalMedRows[0].count,
            expiredBatchesCount: expiredRows[0].count,
            expiringSoonCount: expiringSoonRows[0].count
        });

    } catch (error) {
        console.error('Stats API Error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
