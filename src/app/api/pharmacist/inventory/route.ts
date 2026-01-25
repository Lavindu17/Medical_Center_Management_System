import { NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

// Reusable Auth Check
async function checkAuth() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    const user = await AuthService.verifyToken(token || '');
    if (!user || user.role !== 'PHARMACIST') return false;
    return true;
}

export async function GET() {
    try {
        if (!await checkAuth()) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        // Fetch medicines with their calculated earliest expiry date from active batches
        const medicines = await query(`
            SELECT 
                m.*,
                MIN(b.expiry_date) as earliest_expiry,
                SUM(CASE WHEN b.status = 'ACTIVE' THEN b.quantity_current ELSE 0 END) as batch_stock
            FROM medicines m
            LEFT JOIN inventory_batches b ON m.id = b.medicine_id AND b.status = 'ACTIVE' AND b.quantity_current > 0
            GROUP BY m.id
            ORDER BY m.name ASC
        `);

        return NextResponse.json(medicines);
    } catch (error) {
        console.error('Fetch Inventory Error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        if (!await checkAuth()) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        const body = await req.json();
        const { name, unit, price_per_unit, generic_name, manufacturer, min_stock_level, location, category } = body;

        // Create Master Record Only (Stock = 0)
        await query(
            `INSERT INTO medicines 
            (name, generic_name, manufacturer, stock, min_stock_level, unit, selling_price, buying_price, expiry_date, location, category) 
            VALUES (?, ?, ?, 0, ?, ?, ?, 0, NULL, ?, ?)`, // Default stock 0, expiry NULL
            [
                name,
                generic_name || null,
                manufacturer || null,
                min_stock_level || 10,
                unit,
                price_per_unit || 0, // Standard selling price
                location || null,
                category || null
            ]
        );

        return NextResponse.json({ message: 'Medicine Registered. Please add stock via batches.' });
    } catch (error) {
        console.error('Create Medicine Error:', error);
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        if (!await checkAuth()) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const body = await req.json();
        const { name, unit, price_per_unit, buying_price, expiry_date } = body;

        // NOTE: We do NOT update stock here anymore. Stock is managed via Batches.
        // We only update Master Data (Name, Unit, Prices, etc.)

        await query(
            'UPDATE medicines SET name=?, unit=?, price_per_unit=?, buying_price=?, expiry_date=? WHERE id=?',
            [name, unit, price_per_unit, buying_price || 0, expiry_date, id]
        );

        return NextResponse.json({ message: 'Updated' });
    } catch (error) {
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        if (!await checkAuth()) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        await query('DELETE FROM medicines WHERE id=?', [id]);

        return NextResponse.json({ message: 'Deleted' });
    } catch (error) {
        return NextResponse.json({ message: 'Error' }, { status: 500 });
    }
}
