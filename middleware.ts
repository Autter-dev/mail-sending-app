export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/((?!api/auth|api/v1|api/webhooks|api/public|img|login|unsubscribe|confirm|f|form|t|r|_next/static|_next/image|favicon.ico).*)',
  ],
}
