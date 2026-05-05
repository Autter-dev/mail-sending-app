import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from 'next-auth/middleware'

const TRACKING_HOST = (() => {
  try {
    return process.env.TRACKING_URL ? new URL(process.env.TRACKING_URL).host : null
  } catch {
    return null
  }
})()

const APP_HOST = (() => {
  try {
    return process.env.APP_URL ? new URL(process.env.APP_URL).host : null
  } catch {
    return null
  }
})()

// Paths the tracking host is allowed to serve. Everything else returns 404.
const TRACKING_ALLOWED = [
  /^\/r\//,
  /^\/t\//,
  /^\/unsubscribe(\/|$)/,
  /^\/api\/webhooks\//,
  /^\/_next\/static\//,
  /^\/_next\/image/,
  /^\/favicon\.ico$/,
]

const authMiddleware = withAuth({
  pages: { signIn: '/login' },
})

export default function middleware(req: NextRequest) {
  const host = req.headers.get('host') || ''
  const path = req.nextUrl.pathname

  // If TRACKING_URL is configured to a different host than APP_URL, restrict
  // that host to tracking-only routes. Anything else 404s, so phishing scanners
  // and curious crawlers won't see the login page on the tracker domain.
  if (TRACKING_HOST && APP_HOST && TRACKING_HOST !== APP_HOST && host === TRACKING_HOST) {
    const allowed = TRACKING_ALLOWED.some((re) => re.test(path))
    if (!allowed) {
      return new NextResponse('Not Found', { status: 404 })
    }
    return NextResponse.next()
  }

  // Fall through to NextAuth middleware on the dashboard host.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (authMiddleware as any)(req)
}

export const config = {
  matcher: [
    '/((?!api/auth|api/v1|api/webhooks|api/public|img|login|accept-invite|unsubscribe|confirm|f|form|t|r|_next/static|_next/image|favicon.ico).*)',
    '/r/:path*',
    '/t/:path*',
    '/unsubscribe/:path*',
  ],
}
