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
        const { name, unit, price_per_unit, generic_name, manufacturer, min_stock_level, location, category, dosage_form, strength } = body;

        // Validate required fields
        if (!name || !unit || !price_per_unit) {
            return NextResponse.json({ message: 'Name, unit, and price are required' }, { status: 400 });
        }

        // Create Master Record Only (Stock = 0, no expiry until batch added)
        // Set a far future expiry_date as placeholder (will be updated by batches)
        await query(
            `INSERT INTO medicines 
            (name, generic_name, manufacturer, category, stock, min_stock_level, unit, dosage_form, strength, price_per_unit, buying_price, expiry_date, location) 
            VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 0, '9999-12-31', ?)`,
            [
                name,
                generic_name || null,
                manufacturer || null,
                category || null,
                min_stock_level || 10,
                unit,
                dosage_form || null,
                strength || null,
                price_per_unit,
                location || null
            ]
        );

        return NextResponse.json({ message: 'Medicine registered successfully. Add stock via batches.' });
    } catch (error) {
        console.error('Create Medicine Error:', error);
        return NextResponse.json({ message: 'Error creating medicine' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        if (!await checkAuth()) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const body = await req.json();
        const { name, generic_name, manufacturer, category, unit, price_per_unit, min_stock_level, location, dosage_form, strength } = body;

        if (!id) {
            return NextResponse.json({ message: 'Medicine ID is required' }, { status: 400 });
        }

        // Update ONLY Master Data - Stock, buying_price, and expiry_date are batch-specific
        await query(
            `UPDATE medicines 
             SET name=?, generic_name=?, manufacturer=?, category=?, unit=?, 
                 dosage_form=?, strength=?, price_per_unit=?, min_stock_level=?, location=? 
             WHERE id=?`,
            [
                name,
                generic_name || null,
                manufacturer || null,
                category || null,
                unit,
                dosage_form || null,
                strength || null,
                price_per_unit,
                min_stock_level || 10,
                location || null,
                id
            ]
        );

        return NextResponse.json({ message: 'Medicine updated successfully' });
    } catch (error) {
        console.error('Update Medicine Error:', error);
        return NextResponse.json({ message: 'Error updating medicine' }, { status: 500 });
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
