export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/((?!api/auth|api/v1|api/webhooks|img|login|unsubscribe|confirm|t|r|_next/static|_next/image|favicon.ico).*)',
  ],
}
