import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-change-me';
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

import { jwtVerify } from 'jose';

export async function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    // Public paths that don't require auth
    const publicPaths = ['/login', '/register', '/', '/api/auth/login', '/api/auth/register'];
    if (publicPaths.includes(path) || path.startsWith('/_next') || path.startsWith('/static')) {
        return NextResponse.next();
    }

    const token = request.cookies.get('token')?.value;

    // 1. Check if token exists
    if (!token) {
        // Redirect to login if trying to access protected route
        return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
        // 2. Verify Token
        const { payload } = await jwtVerify(token, SECRET_KEY);
        const role = payload.role as string;

        // 3. Role-Based Access Control
        if (path.startsWith('/patient') && role !== 'PATIENT') {
            return NextResponse.redirect(new URL('/unauthorized', request.url));
        }
        if (path.startsWith('/doctor') && role !== 'DOCTOR') {
            return NextResponse.redirect(new URL('/unauthorized', request.url));
        }
        if (path.startsWith('/admin') && role !== 'ADMIN') {
            return NextResponse.redirect(new URL('/unauthorized', request.url));
        }
        if (path.startsWith('/pharmacist') && role !== 'PHARMACIST') {
            return NextResponse.redirect(new URL('/unauthorized', request.url));
        }
        if (path.startsWith('/lab-assistant') && role !== 'LAB_ASSISTANT') {
            return NextResponse.redirect(new URL('/unauthorized', request.url));
        }
        if (path.startsWith('/receptionist') && role !== 'RECEPTIONIST') {
            return NextResponse.redirect(new URL('/unauthorized', request.url));
        }

        return NextResponse.next();

    } catch (error) {
        // Token invalid or expired
        return NextResponse.redirect(new URL('/login', request.url));
    }
}

export const config = {
    matcher: [
        '/dashboard/:path*',
        '/doctor/:path*',
        '/patient/:path*',
        '/pharmacist/:path*',
        '/lab-assistant/:path*',
        '/receptionist/:path*',
        '/admin/:path*',
    ],
}
