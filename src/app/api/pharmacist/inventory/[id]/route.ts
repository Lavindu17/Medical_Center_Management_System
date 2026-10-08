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
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const user = await getPharmacist();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = params;
        const body = await request.json();
        const { name, category, unit, price_per_unit, min_stock_level, location } = body;

        // Validation
        if (!name || price_per_unit === undefined || price_per_unit === null || Number(price_per_unit) < 0) {
            return NextResponse.json(
                { error: 'Name and a non-negative price per unit are required' },
                { status: 400 }
            );
        }

        await query(
            `UPDATE medicines 
       SET name = ?, generic_name = ?, manufacturer = ?, category = ?, dosage_form = ?, strength = ?, price_per_unit = ?, min_stock_level = ?, unit = ?, location = ?
       WHERE id = ?`,
            [
                name,
                body.generic_name || null,
                body.manufacturer || null,
                category || null,
                body.dosage_form || null,
                body.strength || null,
                price_per_unit,
                min_stock_level ?? 10,
                unit || 'tablets',
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

export async function GET(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const user = await getPharmacist();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id } = params;

        const result = await query('SELECT * FROM medicines WHERE id = ?', [id]);

        // @ts-ignore
        if (result.length === 0) {
            return NextResponse.json({ error: 'Medicine not found' }, { status: 404 });
        }

        // @ts-ignore
        return NextResponse.json(result[0]);
    } catch (error) {
        console.error('Error fetching medicine:', error);
        return NextResponse.json(
            { error: 'Failed to fetch medicine' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
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
