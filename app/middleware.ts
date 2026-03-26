import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    if (!token) return NextResponse.next();

    const role = token.role as string;
    const status = token.status as string;
    const hasStudent = !!(token as any).hasStudent;

    // New Google user - no student record yet (regardless of status)
    if (
      !hasStudent &&
      role !== 'DOCTOR' &&
      role !== 'ADMIN' &&
      pathname !== '/auth/complete-profile' &&
      !pathname.startsWith('/auth/') &&
      !pathname.startsWith('/api/')
    ) {
      return NextResponse.redirect(new URL('/auth/complete-profile', req.url));
    }

    // Has student but PENDING
    if (
      hasStudent &&
      status === 'PENDING' &&
      pathname !== '/auth/pending' &&
      !pathname.startsWith('/auth/') &&
      !pathname.startsWith('/api/')
    ) {
      return NextResponse.redirect(new URL('/auth/pending', req.url));
    }

    // /dashboard smart redirect
    if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
      if (role === 'DOCTOR' || role === 'ADMIN') {
        return NextResponse.redirect(new URL('/doctor', req.url));
      }
      return NextResponse.redirect(new URL('/student/dashboard', req.url));
    }

    // Protect /doctor routes
    if (pathname.startsWith('/doctor')) {
      if (role !== 'DOCTOR' && role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/student/dashboard', req.url));
      }
    }

    // Protect /student routes
    if (pathname.startsWith('/student')) {
      if (role !== 'STUDENT') {
        return NextResponse.redirect(new URL('/doctor', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ req, token }) {
        const pathname = req.nextUrl.pathname;
        const publicPaths = ['/', '/auth/login', '/auth/register', '/auth/error'];
        if (publicPaths.includes(pathname)) return true;
        // Public API endpoints (no auth needed)
        if (pathname.startsWith('/api/auth/')) return true;
        if (pathname === '/api/subjects/departments') return true;
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)',
  ],
};
