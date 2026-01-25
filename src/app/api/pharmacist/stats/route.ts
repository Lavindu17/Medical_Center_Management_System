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

        // 1. Pending Prescriptions
        const [pendingRows]: any = await query('SELECT COUNT(*) as count FROM prescriptions WHERE status = "PENDING"');

        // 2. Low Stock Medicines (Threshold < 20)
        const [lowStockRows]: any = await query('SELECT COUNT(*) as count FROM medicines WHERE stock < 20');

        // 3. Total Medicines
        const [totalMedRows]: any = await query('SELECT COUNT(*) as count FROM medicines');

        return NextResponse.json({
            pendingPrescriptions: pendingRows[0].count,
            lowStockCount: lowStockRows[0].count,
            totalMedicines: totalMedRows[0].count
        });

    } catch (error) {
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
