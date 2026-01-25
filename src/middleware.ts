import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    // TODO: Implement actual authentication check
    // For now, allow all requests

    const path = request.nextUrl.pathname;

    // Example of protected route logic
    const isProtectedRoute = path.startsWith('/dashboard') || path.startsWith('/doctor') || path.startsWith('/patient');

    if (isProtectedRoute) {
        // Check auth token here
        const token = request.cookies.get('token');

        if (!token) {
            // return NextResponse.redirect(new URL('/login', request.url))
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        '/dashboard/:path*',
        '/doctor/:path*',
        '/patient/:path*',
        '/pharmacist/:path*',
        '/lab/:path*',
        '/admin/:path*',
    ],
}
