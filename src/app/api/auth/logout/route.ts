import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
    // Clear the auth cookie
    (await cookies()).delete('token');

    // Return success response
    return NextResponse.json({ message: 'Logged out successfully' });
}

export async function GET(request: Request) {
    // Clear the auth cookie
    (await cookies()).delete('token');

    // Redirect to login page
    return NextResponse.redirect(new URL('/login', request.url));
}
