
import { NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

async function checkAuth() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    const user = await AuthService.verifyToken(token || '');
    if (!user || user.role !== 'PHARMACIST') return false;
    return true;
}

// GET endpoint to fetch batches for a specific medicine
export async function GET(req: Request) {
    try {
        if (!await checkAuth()) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const medicineId = searchParams.get('medicineId');

        if (!medicineId) {
            return NextResponse.json({ message: 'medicineId is required' }, { status: 400 });
        }

        const batches = await query(`
            SELECT 
                id,
                batch_number,
                expiry_date,
                quantity_initial,
                quantity_current,
                buying_price,
                selling_price,
                status,
                received_at,
                DATEDIFF(expiry_date, CURDATE()) as days_until_expiry
            FROM inventory_batches
            WHERE medicine_id = ?
            ORDER BY expiry_date ASC
        `, [medicineId]);

        return NextResponse.json(batches);

    } catch (error) {
        console.error('Fetch Batches Error:', error);
        return NextResponse.json({ message: 'Error fetching batches' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        if (!await checkAuth()) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        const body = await req.json();
        const { medicine_id, batch_number, quantity, buying_price, selling_price, expiry_date } = body;

        if (!medicine_id || !quantity || !expiry_date) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        // Validate expiry date is in the future
        const expiryDateObj = new Date(expiry_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (expiryDateObj <= today) {
            return NextResponse.json({ message: 'Expiry date must be in the future' }, { status: 400 });
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
                    selling_price || 0
                ]
            );

            // 2. Update Master Stock (Aggregate from all active batches)
            await connection.execute(
                'UPDATE medicines SET stock = stock + ? WHERE id = ?',
                [quantity, medicine_id]
            );

            await connection.commit();
            return NextResponse.json({ message: 'Batch added successfully' });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Add Batch Error:', error);
        return NextResponse.json({ message: 'Error adding batch' }, { status: 500 });
    }
}
