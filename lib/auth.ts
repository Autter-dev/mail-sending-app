import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email.toLowerCase().trim()
        const password = credentials.password

        const envAdminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim()
        const envAdminPassword = process.env.ADMIN_PASSWORD

        if (envAdminEmail && email === envAdminEmail && password === envAdminPassword) {
          const passwordHash = await bcrypt.hash(password, 10)
          const existing = await db.query.users.findFirst({ where: eq(users.email, email) })

          if (existing) {
            const [updated] = await db
              .update(users)
              .set({ passwordHash, role: 'admin', lastLoginAt: new Date() })
              .where(eq(users.id, existing.id))
              .returning()
            return {
              id: updated.id,
              email: updated.email,
              name: updated.name ?? 'Admin',
              role: 'admin',
            }
          }

          const [created] = await db
            .insert(users)
            .values({
              email,
              name: 'Admin',
              passwordHash,
              role: 'admin',
              lastLoginAt: new Date(),
            })
            .returning()
          return {
            id: created.id,
            email: created.email,
            name: created.name ?? 'Admin',
            role: 'admin',
          }
        }

        const user = await db.query.users.findFirst({ where: eq(users.email, email) })
        if (!user) return null

        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) return null

        await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role === 'admin' ? 'admin' : 'member',
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.role = token.role
      }
      return session
    },
  },
}
