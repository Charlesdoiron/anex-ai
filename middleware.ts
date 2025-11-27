import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes that don't require authentication
  const publicRoutes = ["/login", "/signup"]
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))

  // API routes for auth and check-env should always be accessible
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/check-env")
  ) {
    return NextResponse.next()
  }

  // Check for session token
  const sessionToken =
    request.cookies.get("__Secure-better-auth.session_token") ??
    request.cookies.get("better-auth.session_token")

  // If accessing a protected route without a session, redirect to login
  if (!isPublicRoute && !sessionToken) {
    const url = new URL("/login", request.url)
    url.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(url)
  }

  // If accessing auth pages with a valid session, redirect to home
  if (isPublicRoute && sessionToken) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$).*)",
  ],
}
