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
  /^\/favicon/,
  /^\/assets\//,
]

// Routes that bypass the auth guard on the dashboard host.
const PUBLIC_PATHS = [
  /^\/login(\/|$)/,
  /^\/api\/auth\//,
  /^\/api\/v1\//,
  /^\/api\/webhooks\//,
  /^\/api\/public\//,
  /^\/img\//,
  /^\/accept-invite(\/|$)/,
  /^\/unsubscribe(\/|$)/,
  /^\/confirm(\/|$)/,
  /^\/f\//,
  /^\/form\//,
  /^\/t\//,
  /^\/r\//,
]

const authMiddleware = withAuth({
  pages: { signIn: '/login' },
})

export default function middleware(req: NextRequest) {
  const host = (req.headers.get('host') || '').toLowerCase()
  const path = req.nextUrl.pathname

  // Host guard: if a separate tracking host is configured, lock it to
  // tracking-only routes. Phishing scanners, crawlers, and casual visitors
  // see a 404 on everything else, including /login.
  if (
    TRACKING_HOST &&
    APP_HOST &&
    TRACKING_HOST !== APP_HOST &&
    host === TRACKING_HOST
  ) {
    if (TRACKING_ALLOWED.some((re) => re.test(path))) {
      return NextResponse.next()
    }
    return new NextResponse('Not Found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  }

  // Dashboard host: skip auth for public routes, otherwise enforce it.
  if (PUBLIC_PATHS.some((re) => re.test(path))) {
    return NextResponse.next()
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (authMiddleware as any)(req)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
