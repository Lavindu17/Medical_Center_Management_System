import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { AuthService } from '@/services/auth.service';
import { cookies } from 'next/headers';

async function getPharmacist() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;
    const user = await AuthService.verifyToken(token);
    // @ts-ignore
    if (!user || user.role !== 'PHARMACIST') return null;
    return user;
}

export async function PUT(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const user = await getPharmacist();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = params;
        const body = await request.json();
        const { name, category, stock, unit, buying_price, selling_price, expiry_date, min_stock_level, location } = body;

        // Validation
        if (!name || stock === undefined || !selling_price) {
            return NextResponse.json(
                { error: 'Name, stock, and selling price are required' },
                { status: 400 }
            );
        }

        await query(
            `UPDATE medicines 
       SET name = ?, generic_name = ?, manufacturer = ?, category = ?, stock = ?, min_stock_level = ?, unit = ?, buying_price = ?, selling_price = ?, expiry_date = ?, location = ?, updated_at = NOW()
       WHERE id = ?`,
            [
                name,
                body.generic_name || null,
                body.manufacturer || null,
                category || null,
                stock,
                min_stock_level || 10,
                unit || 'tablets',
                buying_price || 0,
                selling_price,
                expiry_date || null,
                location || null,
                id
            ]
        );

        return NextResponse.json({ message: 'Medicine updated successfully' });
    } catch (error) {
        console.error('Error updating medicine:', error);
        return NextResponse.json(
            { error: 'Failed to update medicine' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const user = await getPharmacist();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = params;

        const result = await query('DELETE FROM medicines WHERE id = ?', [id]);

        // Check if any row was affected
        // @ts-ignore
        if (result.affectedRows === 0) {
            return NextResponse.json({ error: 'Medicine not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Medicine deleted successfully' });
    } catch (error) {
        console.error('Error deleting medicine:', error);
        return NextResponse.json(
            { error: 'Failed to delete medicine' },
            { status: 500 }
        );
    }
}
