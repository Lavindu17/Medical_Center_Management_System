import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
    // Clear the auth cookie
    (await cookies()).delete('token');

    // Return success response
    return NextResponse.json({ message: 'Logged out successfully' });
}
