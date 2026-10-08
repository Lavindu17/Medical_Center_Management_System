import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
    // Clear the auth cookie
    (await cookies()).delete('token');

    // Return success response
    return NextResponse.json({ message: 'Logged out successfully' });
}

// The sidebar's "Sign Out" is a plain link, so GET must keep working - but another website must not be able to
// sign people out by embedding this URL (an <img> or a redirect). Browsers label such requests as cross-site.
export async function GET(request: Request) {
    const site = request.headers.get('sec-fetch-site');
    if (site && site !== 'same-origin' && site !== 'none') {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    // Clear the auth cookie
    (await cookies()).delete('token');

    // Redirect to login page
    return NextResponse.redirect(new URL('/login', request.url));
}
