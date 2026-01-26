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
        const [pendingRows]: any = await query('SELECT COUNT(*) as count FROM prescriptions WHERE status = "PENDING"');

        // 2. Low Stock Medicines (Below min_stock_level or < 20 if not set)
        const [lowStockRows]: any = await query(`
            SELECT COUNT(*) as count 
            FROM medicines 
            WHERE stock < COALESCE(min_stock_level, 20)
        `);

        // 3. Total Medicines
        const [totalMedRows]: any = await query('SELECT COUNT(*) as count FROM medicines');

        // 4. Expired Batches Count
        const [expiredRows]: any = await query(`
            SELECT COUNT(*) as count 
            FROM inventory_batches 
            WHERE expiry_date < ? 
              AND quantity_current > 0 
              AND status = 'ACTIVE'
        `, [today]);

        // 5. Expiring Soon (within 30 days)
        const [expiringSoonRows]: any = await query(`
            SELECT COUNT(*) as count 
            FROM inventory_batches 
            WHERE expiry_date >= ? 
              AND expiry_date <= ? 
              AND quantity_current > 0 
              AND status = 'ACTIVE'
        `, [today, thirtyDaysFromNow]);

        return NextResponse.json({
            pendingPrescriptions: pendingRows[0].count,
            lowStockCount: lowStockRows[0].count,
            totalMedicines: totalMedRows[0].count,
            expiredBatchesCount: expiredRows[0].count,
            expiringSoonCount: expiringSoonRows[0].count
        });

    } catch (error) {
        console.error('Stats API Error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
