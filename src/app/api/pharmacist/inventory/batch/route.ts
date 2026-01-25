
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

async function checkAuth() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    const user = await AuthService.verifyToken(token || '');
    if (!user || user.role !== 'PHARMACIST') return false;
    return true;
}

export async function POST(req: Request) {
    try {
        if (!await checkAuth()) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        const body = await req.json();
        const { medicine_id, batch_number, quantity, buying_price, selling_price, expiry_date } = body;

        if (!medicine_id || !quantity || !expiry_date) {
            return NextResponse.json({ message: 'Missing fields' }, { status: 400 });
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // 1. Create Batch
            await connection.execute(
                `INSERT INTO inventory_batches 
                (medicine_id, batch_number, expiry_date, quantity_initial, quantity_current, buying_price, selling_price, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
                [
                    medicine_id,
                    batch_number || `BATCH-${Date.now()}`,
                    expiry_date,
                    quantity,
                    quantity,
                    buying_price || 0,
                    selling_price || 0 // Default to 0 or fetch from medicine master? Better to require it or fallback.
                ]
            );

            // 2. Update Master Stock
            await connection.execute(
                'UPDATE medicines SET stock = stock + ? WHERE id = ?',
                [quantity, medicine_id]
            );

            // 3. Update Master Prices ?? Optional. User might want latest batch price to be "Current Price".
            // Let's update Master Price to reflect latest batch (LIFO for replacement cost visibility)
            if (selling_price) {
                await connection.execute(
                    'UPDATE medicines SET selling_price = ? WHERE id = ?',
                    [selling_price, medicine_id]
                );
            }

            await connection.commit();
            return NextResponse.json({ message: 'Batch Added' });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Add Batch Error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
