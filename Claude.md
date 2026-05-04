# CLAUDE.md — Broadcast Email Tool Build Instructions

You are building an open source self-hostable broadcast email tool. Follow each phase in order. Complete every step in a phase before moving to the next. Do not skip steps.

---

## Project Overview

- **Framework:** Next.js 14 (App Router, TypeScript, standalone output)
- **ORM:** Drizzle ORM with PostgreSQL
- **Queue:** pg-boss (Postgres-native, no Redis)
- **Storage:** @aws-sdk/client-s3 (works with AWS S3 and MinIO)
- **Email:** Resend SDK + @aws-sdk/client-ses (pluggable adapter)
- **Auth:** NextAuth.js v4 (credentials provider)
- **UI:** Tailwind CSS + shadcn/ui
- **Styling rule:** No em dashes anywhere in UI copy or code comments. Use commas, colons, or short sentences instead.

---

## Phase 1: Project Scaffold and Infrastructure

### Step 1.1: Initialize Next.js project

```bash
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
```

### Step 1.2: Install all dependencies

```bash
npm install drizzle-orm pg pg-boss next-auth bcryptjs resend @aws-sdk/client-ses @aws-sdk/client-s3 @aws-sdk/s3-request-presigner xlsx handlebars juice zod @anatine/zod-openapi recharts date-fns nanoid

npm install -D drizzle-kit @types/pg @types/bcryptjs @types/handlebars @types/node tsx dotenv-cli
```

### Step 1.3: Install and initialize shadcn/ui

```bash
npx shadcn-ui@latest init
```

When prompted:
- Style: Default
- Base color: Slate
- CSS variables: Yes

Then add components:

```bash
npx shadcn-ui@latest add button input label card table badge tabs dialog dropdown-menu select textarea toast progress separator skeleton
```

### Step 1.4: Create the environment file

Create `.env.local`:

```bash
# App
APP_URL=http://localhost:3000
APP_NAME=hedwig-mail
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=changeme-use-openssl-rand-base64-32

# Admin credentials
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=changeme

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/emailtool

# Storage (MinIO for local, AWS S3 for production)
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=emailtool
S3_FORCE_PATH_STYLE=true

# Security
ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000

# Worker
WORKER_CONCURRENCY=5
```

Create `.env.example` as a copy of `.env.local` with all values replaced by descriptive placeholders.

### Step 1.5: Update `next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['pg', 'pg-boss'],
  },
}

module.exports = nextConfig
```

### Step 1.6: Create Drizzle config

Create `drizzle.config.ts`:

```typescript
import type { Config } from 'drizzle-kit'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config
```

Add to `package.json` scripts:

```json
"db:generate": "drizzle-kit generate:pg",
"db:migrate": "dotenv-cli -e .env.local -- tsx lib/db/migrate.ts",
"db:studio": "drizzle-kit studio",
"worker": "dotenv-cli -e .env.local -- tsx worker.ts"
```

### Step 1.7: Create the database schema

Create `lib/db/schema.ts`:

```typescript
import {
  pgTable, uuid, text, timestamp, boolean, integer, jsonb, unique
} from 'drizzle-orm/pg-core'

export const lists = pgTable('lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  listId: uuid('list_id').notNull().references(() => lists.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  metadata: jsonb('metadata').default({}).$type<Record<string, string>>(),
  status: text('status').notNull().default('active'), // active | bounced | unsubscribed
  unsubscribeToken: uuid('unsubscribe_token').notNull().defaultRandom().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueListEmail: unique().on(t.listId, t.email),
}))

export const emailProviders = pgTable('email_providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: text('type').notNull(), // resend | ses
  configEncrypted: text('config_encrypted').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  rateLimitPerSecond: integer('rate_limit_per_second').notNull().default(10),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  subject: text('subject').notNull().default(''),
  fromName: text('from_name').notNull().default(''),
  fromEmail: text('from_email').notNull().default(''),
  listId: uuid('list_id').notNull().references(() => lists.id),
  providerId: uuid('provider_id').references(() => emailProviders.id),
  templateJson: jsonb('template_json').notNull().default([]).$type<Block[]>(),
  templateHtml: text('template_html'),
  status: text('status').notNull().default('draft'), // draft | scheduled | sending | sent | failed
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  totalRecipients: integer('total_recipients'),
  cancelRequested: boolean('cancel_requested').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const campaignSends = pgTable('campaign_sends', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'), // pending | sent | bounced | failed
  providerMessageId: text('provider_message_id'),
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueCampaignContact: unique().on(t.campaignId, t.contactId),
}))

export const campaignEvents = pgTable('campaign_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignSendId: uuid('campaign_send_id').notNull().references(() => campaignSends.id, { onDelete: 'cascade' }),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // open | click | bounce | complaint | unsubscribe
  linkUrl: text('link_url'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Block type used in templateJson
export type BlockType = 'heading' | 'text' | 'image' | 'button' | 'divider' | 'spacer'

export interface Block {
  id: string
  type: BlockType
  props: Record<string, unknown>
}

// Drizzle inferred types
export type List = typeof lists.$inferSelect
export type Contact = typeof contacts.$inferSelect
export type EmailProvider = typeof emailProviders.$inferSelect
export type Campaign = typeof campaigns.$inferSelect
export type CampaignSend = typeof campaignSends.$inferSelect
export type CampaignEvent = typeof campaignEvents.$inferSelect
export type ApiKey = typeof apiKeys.$inferSelect
```

### Step 1.8: Create the database client

Create `lib/db/index.ts`:

```typescript
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 10,
})

export const db = drizzle(pool, { schema })
export { pool }
```

Create `lib/db/migrate.ts`:

```typescript
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db, pool } from './index'

async function main() {
  console.log('Running migrations...')
  await migrate(db, { migrationsFolder: './drizzle/migrations' })
  console.log('Migrations complete.')
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

### Step 1.9: Generate and run migrations

```bash
npm run db:generate
npm run db:migrate
```

### Step 1.10: Create the encryption utility

Create `lib/encryption/index.ts`:

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')

export function encrypt(text: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decrypt(encoded: string): string {
  const buf = Buffer.from(encoded, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const encrypted = buf.subarray(28)
  const decipher = createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}
```

### Step 1.11: Create the S3/MinIO storage utility

Create `lib/storage/index.ts`:

```typescript
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const client = new S3Client({
  region: process.env.S3_REGION!,
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.S3_BUCKET!

export async function uploadFile(key: string, body: Buffer, contentType: string) {
  await client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }))
  return key
}

export async function getPresignedUrl(key: string, expiresIn = 3600) {
  return getSignedUrl(client, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn })
}

export async function deleteFile(key: string) {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}
```

### Step 1.12: Create the email provider adapters

Create `lib/providers/types.ts`:

```typescript
export interface SendOptions {
  to: string
  from: string
  fromName: string
  subject: string
  html: string
  headers?: Record<string, string>
}

export interface EmailProviderAdapter {
  send(options: SendOptions): Promise<{ messageId: string }>
  validate(): Promise<boolean>
}

export interface ProviderConfig {
  apiKey?: string
  region?: string
  fromDomain?: string
}
```

Create `lib/providers/resend.ts`:

```typescript
import { Resend } from 'resend'
import type { EmailProviderAdapter, SendOptions, ProviderConfig } from './types'

export class ResendAdapter implements EmailProviderAdapter {
  private client: Resend

  constructor(config: ProviderConfig) {
    this.client = new Resend(config.apiKey!)
  }

  async send(options: SendOptions): Promise<{ messageId: string }> {
    const { data, error } = await this.client.emails.send({
      from: `${options.fromName} <${options.from}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      headers: options.headers,
    })
    if (error) throw new Error(error.message)
    return { messageId: data!.id }
  }

  async validate(): Promise<boolean> {
    try {
      await this.client.domains.list()
      return true
    } catch {
      return false
    }
  }
}
```

Create `lib/providers/ses.ts`:

```typescript
import { SESClient, SendEmailCommand, GetAccountSendingEnabledCommand } from '@aws-sdk/client-ses'
import type { EmailProviderAdapter, SendOptions, ProviderConfig } from './types'

export class SESAdapter implements EmailProviderAdapter {
  private client: SESClient

  constructor(config: ProviderConfig) {
    this.client = new SESClient({
      region: config.region!,
      credentials: {
        accessKeyId: config.apiKey!.split(':')[0],
        secretAccessKey: config.apiKey!.split(':')[1],
      },
    })
  }

  async send(options: SendOptions): Promise<{ messageId: string }> {
    const result = await this.client.send(new SendEmailCommand({
      Source: `${options.fromName} <${options.from}>`,
      Destination: { ToAddresses: [options.to] },
      Message: {
        Subject: { Data: options.subject, Charset: 'UTF-8' },
        Body: { Html: { Data: options.html, Charset: 'UTF-8' } },
      },
    }))
    return { messageId: result.MessageId! }
  }

  async validate(): Promise<boolean> {
    try {
      await this.client.send(new GetAccountSendingEnabledCommand({}))
      return true
    } catch {
      return false
    }
  }
}
```

Create `lib/providers/factory.ts`:

```typescript
import { decrypt } from '@/lib/encryption'
import { ResendAdapter } from './resend'
import { SESAdapter } from './ses'
import type { EmailProviderAdapter, ProviderConfig } from './types'

export function createProviderAdapter(type: string, configEncrypted: string): EmailProviderAdapter {
  const config: ProviderConfig = JSON.parse(decrypt(configEncrypted))
  if (type === 'resend') return new ResendAdapter(config)
  if (type === 'ses') return new SESAdapter(config)
  throw new Error(`Unknown provider type: ${type}`)
}
```

### Step 1.13: Create the template renderer

Create `lib/renderer/index.ts`:

```typescript
import Handlebars from 'handlebars'
import juice from 'juice'
import type { Block } from '@/lib/db/schema'

export function renderBlocks(blocks: Block[]): string {
  return blocks.map(renderBlock).join('\n')
}

function renderBlock(block: Block): string {
  const p = block.props as Record<string, string>
  switch (block.type) {
    case 'heading':
      return `<h2 style="font-family:sans-serif;font-size:${p.fontSize || '24px'};color:${p.color || '#111827'};margin:0 0 16px 0;">${p.text || ''}</h2>`
    case 'text':
      return `<p style="font-family:sans-serif;font-size:${p.fontSize || '16px'};color:${p.color || '#374151'};margin:0 0 16px 0;line-height:1.6;">${p.text || ''}</p>`
    case 'button':
      return `<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="${p.align || 'center'}" style="padding:8px 0;"><a href="${p.url || '#'}" style="display:inline-block;background:${p.bgColor || '#2563eb'};color:${p.textColor || '#ffffff'};font-family:sans-serif;font-size:16px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:6px;">${p.text || 'Click here'}</a></td></tr></table>`
    case 'image':
      return `<img src="${p.src || ''}" alt="${p.alt || ''}" width="${p.width || '100%'}" style="display:block;max-width:100%;border:0;" />`
    case 'divider':
      return `<hr style="border:none;border-top:1px solid ${p.color || '#e5e7eb'};margin:24px 0;" />`
    case 'spacer':
      return `<div style="height:${p.height || '24px'};"></div>`
    default:
      return ''
  }
}

export function renderTemplate(options: {
  blocks: Block[]
  contact: Record<string, string>
  sendId: string
  appUrl: string
  unsubscribeUrl: string
}): string {
  const { blocks, contact, sendId, appUrl, unsubscribeUrl } = options

  const bodyHtml = renderBlocks(blocks)

  const template = Handlebars.compile(bodyHtml)
  const merged = template(contact)

  const withTracking = wrapLinks(merged, sendId, appUrl)

  const trackingPixel = `<img src="${appUrl}/t/${sendId}" width="1" height="1" border="0" style="display:block;" />`

  const unsubscribeFooter = `
    <div style="text-align:center;padding:24px 0;font-family:sans-serif;font-size:12px;color:#9ca3af;">
      <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
    </div>
  `

  const full = `
    <html><body style="margin:0;padding:0;background:#f9fafb;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:40px;max-width:600px;">
            <tr><td>${withTracking}</td></tr>
            <tr><td>${unsubscribeFooter}</td></tr>
            <tr><td>${trackingPixel}</td></tr>
          </table>
        </td></tr>
      </table>
    </body></html>
  `

  return juice(full)
}

function wrapLinks(html: string, sendId: string, appUrl: string): string {
  return html.replace(
    /href="((?!APP_URL\/r\/|APP_URL\/unsubscribe\/)[^"]+)"/g,
    (_, url) => {
      const encoded = Buffer.from(JSON.stringify({ sendId, url })).toString('base64url')
      return `href="${appUrl}/r/${encoded}"`
    }
  )
}
```

### Step 1.14: Create the pg-boss queue setup

Create `lib/queue/index.ts`:

```typescript
import PgBoss from 'pg-boss'

let boss: PgBoss | null = null

export async function getQueue(): Promise<PgBoss> {
  if (!boss) {
    boss = new PgBoss({
      connectionString: process.env.DATABASE_URL!,
      max: 10,
    })
    await boss.start()
  }
  return boss
}

export const JOBS = {
  SEND_CAMPAIGN: 'send-campaign',
  SEND_EMAIL: 'send-email',
  FINALIZE_CAMPAIGN: 'finalize-campaign',
} as const
```

### Step 1.15: Create the background worker

Create `worker.ts` at the project root:

```typescript
import 'dotenv/config'
import PgBoss from 'pg-boss'
import { db } from './lib/db'
import { campaigns, campaignSends, contacts, emailProviders } from './lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { createProviderAdapter } from './lib/providers/factory'
import { renderTemplate } from './lib/renderer'
import { JOBS } from './lib/queue'

const APP_URL = process.env.APP_URL!
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5')

async function main() {
  console.log('Worker starting...')

  const boss = new PgBoss({
    connectionString: process.env.DATABASE_URL!,
    max: 10,
  })

  await boss.start()
  console.log('pg-boss started.')

  // Process individual email send jobs
  await boss.work(JOBS.SEND_EMAIL, { teamSize: CONCURRENCY, teamConcurrency: CONCURRENCY }, async (job) => {
    const { sendId, campaignId } = job.data as { sendId: string; campaignId: string }

    // Check for cancel
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId))
    if (!campaign || campaign.cancelRequested) {
      await db.update(campaignSends).set({ status: 'failed', errorMessage: 'Cancelled' }).where(eq(campaignSends.id, sendId))
      return
    }

    const [send] = await db.select().from(campaignSends).where(eq(campaignSends.id, sendId))
    if (!send) return

    const [contact] = await db.select().from(contacts).where(eq(contacts.id, send.contactId))
    if (!contact || contact.status !== 'active') {
      await db.update(campaignSends).set({ status: 'failed', errorMessage: 'Contact not active' }).where(eq(campaignSends.id, sendId))
      return
    }

    const [provider] = await db.select().from(emailProviders).where(eq(emailProviders.id, campaign.providerId!))
    if (!provider) throw new Error('Provider not found')

    const adapter = createProviderAdapter(provider.type, provider.configEncrypted)

    const contactData: Record<string, string> = {
      email: contact.email,
      first_name: contact.firstName || '',
      last_name: contact.lastName || '',
      ...(contact.metadata as Record<string, string>),
    }

    const html = renderTemplate({
      blocks: campaign.templateJson,
      contact: contactData,
      sendId: send.id,
      appUrl: APP_URL,
      unsubscribeUrl: `${APP_URL}/unsubscribe/${contact.unsubscribeToken}`,
    })

    const { messageId } = await adapter.send({
      to: contact.email,
      from: campaign.fromEmail,
      fromName: campaign.fromName,
      subject: campaign.subject,
      html,
      headers: {
        'List-Unsubscribe': `<${APP_URL}/unsubscribe/${contact.unsubscribeToken}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })

    await db.update(campaignSends).set({
      status: 'sent',
      providerMessageId: messageId,
      sentAt: new Date(),
    }).where(eq(campaignSends.id, send.id))
  })

  // Finalize campaign after all sends complete
  await boss.work(JOBS.FINALIZE_CAMPAIGN, async (job) => {
    const { campaignId } = job.data as { campaignId: string }
    await db.update(campaigns).set({ status: 'sent', sentAt: new Date() }).where(eq(campaigns.id, campaignId))
  })

  console.log('Worker ready. Processing jobs...')
  process.on('SIGTERM', async () => { await boss.stop(); process.exit(0) })
}

main().catch((err) => { console.error(err); process.exit(1) })
```

### Step 1.16: Create auth config

Create `lib/auth.ts`:

```typescript
import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'

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
        if (credentials.email !== process.env.ADMIN_EMAIL) return null

        const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD!, 10)
        const valid = await bcrypt.compare(credentials.password, passwordHash)

        // In production, compare directly without hashing each time
        const directMatch = credentials.password === process.env.ADMIN_PASSWORD
        if (!directMatch) return null

        return { id: 'admin', email: credentials.email, name: 'Admin' }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
}
```

Create `app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

Create `middleware.ts` at project root:

```typescript
export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/((?!api/auth|api/v1|api/webhooks|login|unsubscribe|t|r|_next/static|_next/image|favicon.ico).*)',
  ],
}
```

### Step 1.17: Create Docker files

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/worker.ts ./worker.ts
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/tsconfig.json ./tsconfig.json

USER nextjs
EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

Create `docker-compose.yml`:

```yaml
version: "3.9"

services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file: .env.local
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/emailtool
      S3_ENDPOINT: http://minio:9000
      S3_FORCE_PATH_STYLE: "true"
      S3_ACCESS_KEY_ID: minioadmin
      S3_SECRET_ACCESS_KEY: minioadmin
    depends_on:
      db:
        condition: service_healthy
      minio:
        condition: service_healthy

  worker:
    build: .
    command: node -r tsx/cjs worker.ts
    env_file: .env.local
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/emailtool
      S3_ENDPOINT: http://minio:9000
      S3_FORCE_PATH_STYLE: "true"
      S3_ACCESS_KEY_ID: minioadmin
      S3_SECRET_ACCESS_KEY: minioadmin
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: emailtool
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  minio_data:
```

---

## Phase 2: Contact List Management

### Step 2.1: API routes for lists

Create `app/api/internal/lists/route.ts`:
- `GET`: return all lists with contact counts (join with contacts table, count by status)
- `POST`: validate body (`name` required, `description` optional), insert into lists table, return created list

Create `app/api/internal/lists/[id]/route.ts`:
- `GET`: return list by id with counts
- `DELETE`: delete list (cascade deletes contacts)

Create `app/api/internal/lists/[id]/contacts/route.ts`:
- `GET`: paginated contacts. Query params: `page` (default 1), `limit` (default 50), `status` (optional filter), `search` (email search with `ilike`)
- Returns: `{ data: Contact[], meta: { page, limit, total } }`

### Step 2.2: CSV/XLSX upload API

Create `app/api/internal/lists/[id]/upload/route.ts`:

This route handles `POST` with `multipart/form-data`.

Logic:
1. Parse the uploaded file from the request using `formData()`.
2. Read bytes as ArrayBuffer.
3. Use SheetJS: `read(buffer, { type: 'buffer' })`.
4. Get the first sheet: `wb.Sheets[wb.SheetNames[0]]`.
5. Convert to JSON: `utils.sheet_to_json(sheet, { header: 1 })`.
6. First row is the header. Return headers and first 5 rows as preview. Store the file on S3 with key `uploads/${listId}/${Date.now()}.xlsx`.
7. Return `{ headers: string[], preview: string[][] }` for the column mapping UI.

Create `app/api/internal/lists/[id]/upload/confirm/route.ts`:

This route handles `POST` with JSON body: `{ s3Key, mapping: { email, firstName, lastName, metadata: string[] } }`.

Logic:
1. Fetch the file from S3.
2. Parse with SheetJS.
3. Map rows to contact objects using the mapping config.
4. Upsert contacts in batches of 500 using Drizzle `onConflictDoUpdate`.
5. Return `{ inserted: number, updated: number, skipped: number }`.

### Step 2.3: List pages UI

Create `app/(dashboard)/lists/page.tsx`:
- Fetch all lists from internal API.
- Show a table: list name, total contacts, active, bounced, unsubscribed, created date, delete button.
- "New List" button opens a dialog with name and description inputs.

Create `app/(dashboard)/lists/[id]/page.tsx`:
- Tabs: "Active", "Bounced", "Unsubscribed".
- Contacts table: email, first name, last name, created date. Paginated.
- Search bar filters by email.
- "Upload Contacts" button.
- "Export CSV" button (calls API, triggers download).

Create `app/(dashboard)/lists/[id]/upload/page.tsx`:
- Step 1: File drop zone. Accept `.csv` and `.xlsx`. On upload, show column headers and 5-row preview.
- Step 2: Column mapping. Dropdowns for each column: maps to email, first name, last name, or a custom metadata key (user can type a key name). Email column mapping is required.
- Step 3: Confirmation. Show "importing X contacts..." with a progress indicator. On complete, show results and redirect to the list page.

---

## Phase 3: Email Provider Integration

### Step 3.1: Provider API routes

Create `app/api/internal/providers/route.ts`:
- `GET`: return all providers (decrypt config, return only non-sensitive fields: id, name, type, isDefault, rateLimitPerSecond, fromDomain)
- `POST`: validate body (name, type, config fields), encrypt config, insert provider

Create `app/api/internal/providers/[id]/route.ts`:
- `DELETE`: delete provider
- `PATCH`: update isDefault (set this provider as default, unset all others)

Create `app/api/internal/providers/[id]/validate/route.ts`:
- `POST`: load provider, decrypt config, build adapter, call `adapter.validate()`, return `{ valid: boolean }`

### Step 3.2: Provider settings UI

Create `app/(dashboard)/settings/providers/page.tsx`:
- List all connected providers. Show type badge, default badge, rate limit.
- "Add Provider" button opens a dialog.
- Dialog has a type selector (Resend or SES). On type selection, show relevant fields:
  - Resend: API key field
  - SES: Access Key ID, Secret Access Key, Region fields (store as `apiKey: "id:secret"`)
- "Validate Connection" button calls the validate endpoint before saving.
- Each provider row has a "Set as Default" button and a delete button.

### Step 3.3: Webhook routes

Create `app/api/webhooks/resend/route.ts`:

```typescript
// POST handler
// 1. Read raw body as text for signature verification
// 2. Verify Resend webhook signature using svix:
//    import { Webhook } from 'svix'
//    const wh = new Webhook(process.env.RESEND_WEBHOOK_SECRET!)
//    wh.verify(rawBody, headers)
// 3. Parse event type
// 4. On 'email.bounced': find campaign_send by providerMessageId, update status to bounced, update contact status to bounced
// 5. On 'email.complained': same but set contact status to unsubscribed
// 6. Insert campaign_events row for each event
// 7. Return 200
```

Create `app/api/webhooks/ses/route.ts`:

```typescript
// POST handler
// 1. Parse SNS JSON body
// 2. If Type === 'SubscriptionConfirmation': fetch SubscribeURL to confirm
// 3. If Type === 'Notification': parse Message JSON
//    - notificationType === 'Bounce': handle bounce (bouncedRecipients array)
//    - notificationType === 'Complaint': handle complaint
// 4. Same DB updates as Resend webhook
// 5. Return 200
```

Install svix for webhook verification: `npm install svix`

---

## Phase 4: Mail Editor

### Step 4.1: Block editor components

Create `components/editor/BlockEditor.tsx`:
- Props: `blocks: Block[]`, `onChange: (blocks: Block[]) => void`
- Left panel: block type picker (heading, text, image, button, divider, spacer). Click to add block at bottom.
- Center panel: live preview rendered as HTML in an iframe using `srcDoc`. Show mobile/desktop toggle that changes iframe width.
- Right panel: block property editor. Clicking a block in the preview selects it. Show relevant inputs for its type.
- Drag to reorder blocks (use `@hello-pangea/dnd` or manual drag state).

Install: `npm install @hello-pangea/dnd`

Create `components/editor/blocks/HeadingBlock.tsx` — props: text, fontSize, color, alignment
Create `components/editor/blocks/TextBlock.tsx` — props: text (multiline), fontSize, color
Create `components/editor/blocks/ButtonBlock.tsx` — props: text, url, bgColor, textColor, align
Create `components/editor/blocks/ImageBlock.tsx` — props: src (file upload or URL), alt, width
Create `components/editor/blocks/DividerBlock.tsx` — props: color
Create `components/editor/blocks/SpacerBlock.tsx` — props: height

Each block component renders the property form for the right panel. Use the block's `props` object.

### Step 4.2: Editor page

Create `app/(dashboard)/editor/[campaignId]/page.tsx`:

Top bar:
- Campaign name (editable inline)
- Subject line input
- From name and from email inputs
- "Save Draft" button (auto-save every 30 seconds too)
- "Send Test Email" button (opens dialog, input email, calls test send API)
- "Back to Campaign" link

Below top bar: the BlockEditor component.

Bottom bar:
- Merge tag picker: fetches the campaign's list metadata keys, shows available tags like `{{first_name}}`, `{{email}}`. Clicking copies to clipboard with a toast.

### Step 4.3: Editor API routes

Create `app/api/internal/campaigns/[id]/route.ts`:
- `GET`: return campaign
- `PATCH`: update any campaign fields (name, subject, fromName, fromEmail, templateJson, listId, providerId)

Create `app/api/internal/campaigns/[id]/test-send/route.ts`:
- `POST`: body `{ toEmail: string }`
- Fetch campaign and its provider
- Render template with dummy contact data: `{ email: toEmail, first_name: 'Test', last_name: 'User' }`
- Send immediately via provider adapter
- Return `{ success: true }`

---

## Phase 5: Campaign Management and Sending

### Step 5.1: Campaign list and create

Create `app/api/internal/campaigns/route.ts`:
- `GET`: return all campaigns with send stats (join with campaign_sends, count by status). Include open rate and click rate.
- `POST`: create new campaign (name, listId required). Set status to draft. Return created campaign. Redirect client to `/editor/[id]`.

Create `app/(dashboard)/campaigns/page.tsx`:
- Table: name, list name, status badge, recipients, open rate, click rate, sent date, actions.
- Status badge colors: draft=gray, scheduled=yellow, sending=blue, sent=green, failed=red.
- "New Campaign" button: opens dialog to pick name and list, then redirects to editor.
- Row click goes to campaign detail page.

### Step 5.2: Campaign send API

Create `app/api/internal/campaigns/[id]/send/route.ts`:
- `POST`: body `{ scheduledAt?: string }` (ISO timestamp, optional)

Logic:
1. Fetch campaign, validate it has subject, fromEmail, fromName, providerId, listId.
2. Fetch all `active` contacts for the list.
3. If none, return 400.
4. Set `campaigns.status = 'sending'`, `campaigns.totalRecipients = contacts.length`.
5. Insert `campaign_sends` rows for all contacts in batches of 500.
6. Enqueue one pg-boss job per contact send: `JOBS.SEND_EMAIL` with `{ sendId, campaignId }`. Use `startAfter` if scheduledAt provided.
7. Enqueue `JOBS.FINALIZE_CAMPAIGN` with a delay equal to estimated completion time.
8. Return `{ queued: number }`.

Import and use `getQueue()` from `lib/queue/index.ts`.

Create `app/api/internal/campaigns/[id]/cancel/route.ts`:
- `POST`: set `campaigns.cancelRequested = true` and `campaigns.status = 'draft'`. Worker checks this flag before processing each job.

### Step 5.3: Campaign detail page

Create `app/(dashboard)/campaigns/[id]/page.tsx`:
- Show campaign metadata: name, list, subject, from, status, scheduled time if applicable.
- If status is draft: show "Configure in Editor" button and "Send Campaign" button (with optional schedule picker).
- If status is sending: show live progress bar (sent / totalRecipients). Poll every 3 seconds. Show cancel button.
- If status is sent: show summary stats and link to analytics page.
- If status is scheduled: show scheduled time and cancel button.

---

## Phase 6: Open and Click Tracking

### Step 6.1: Tracking routes

Create `app/t/[sendId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { campaignSends, campaignEvents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(req: NextRequest, { params }: { params: { sendId: string } }) {
  const send = await db.query.campaignSends.findFirst({
    where: eq(campaignSends.id, params.sendId),
  })

  if (send) {
    await db.insert(campaignEvents).values({
      campaignSendId: send.id,
      campaignId: send.campaignId,
      type: 'open',
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    })
  }

  // Return 1x1 transparent GIF
  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
  return new NextResponse(gif, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
```

Create `app/r/[id]/route.ts`:

```typescript
// Decode the base64url payload: { sendId, url }
// Insert campaign_events row (type: click, linkUrl: url)
// Redirect to the original URL
```

### Step 6.2: Analytics API

Create `app/api/internal/campaigns/[id]/analytics/route.ts`:
- `GET`: Return:
  - `sent`: count of campaign_sends where status = sent
  - `bounced`: count where status = bounced
  - `failed`: count where status = failed
  - `opens`: count of distinct campaign_send_ids in campaign_events where type = open
  - `clicks`: count of distinct campaign_send_ids in campaign_events where type = click
  - `topLinks`: group by linkUrl, count clicks per link, top 10
  - `timeline`: group opens and clicks by hour (last 7 days), return array of `{ hour, opens, clicks }`

### Step 6.3: Analytics page

Create `app/(dashboard)/campaigns/[id]/analytics/page.tsx`:
- Summary cards: Sent, Open Rate, Click Rate, Bounced.
- Recharts `LineChart` for timeline: x axis = hour, two lines = opens and clicks.
- Top clicked links table.
- "Back to Campaign" link.

---

## Phase 7: Unsubscribe Page

Create `app/unsubscribe/[token]/page.tsx`:

This is a server component. No auth required.

```typescript
// 1. Look up contact by unsubscribeToken
// 2. If not found: show "This link is invalid or has already been used."
// 3. If status is already 'unsubscribed': show "You are already unsubscribed."
// 4. Otherwise: show confirmation page with the contact's email and list name

// POST action (server action or form POST to same route):
// - Set contact.status = 'unsubscribed'
// - Insert campaign_events row if there is a recent campaign_send for this contact
// - Show "You have been unsubscribed." confirmation
```

Style this page minimally. Show `APP_NAME` from env. No navigation, no dashboard chrome.

---

## Phase 8: Public REST API

### Step 8.1: API key middleware

Create `lib/api-auth.ts`:

```typescript
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiKeys } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

export async function authenticateApiKey(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return false
  const rawKey = auth.slice(7)

  const allKeys = await db.select().from(apiKeys)
  for (const key of allKeys) {
    const valid = await bcrypt.compare(rawKey, key.keyHash)
    if (valid) {
      await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id))
      return true
    }
  }
  return false
}
```

### Step 8.2: API key management

Create `app/api/internal/api-keys/route.ts`:
- `GET`: return all api keys (id, name, lastUsedAt, createdAt — never return keyHash)
- `POST`: body `{ name }`. Generate key with `nanoid(32)`. Hash with bcrypt. Store hash. Return `{ id, name, key }` — key is shown only once.

Create `app/api/internal/api-keys/[id]/route.ts`:
- `DELETE`: delete api key

Create `app/(dashboard)/settings/api-keys/page.tsx`:
- List keys: name, last used, created.
- "Create Key" button: shows dialog with name input. After creation, shows the key in a one-time display with a copy button and a warning that it will not be shown again.
- Delete button per key (with confirmation dialog).

### Step 8.3: Public API routes

Create `app/api/v1/lists/route.ts`:
- Authenticate with `authenticateApiKey`.
- `GET`: return lists. `POST`: create list.

Create `app/api/v1/lists/[listId]/contacts/route.ts`:
- `GET`: paginated contacts with filters. `POST`: create contact.

Create `app/api/v1/lists/[listId]/contacts/bulk/route.ts`:
- `POST`: body `{ contacts: ContactInput[] }` (max 1000). Upsert all. Return counts.

Create `app/api/v1/lists/[listId]/contacts/[id]/route.ts`:
- `PUT`: update contact. `DELETE`: remove contact.

Create `app/api/v1/campaigns/route.ts`:
- `GET`: read-only list of campaigns.

Create `app/api/v1/campaigns/[id]/route.ts`:
- `GET`: campaign detail.

Create `app/api/v1/campaigns/[id]/stats/route.ts`:
- `GET`: same data as analytics endpoint.

All v1 routes return `{ data, meta, error }` envelope. On auth failure return 401. On validation failure return 400 with Zod error details.

---

## Phase 9: Dashboard Layout and Navigation

### Step 9.1: Root layout and auth

Create `app/login/page.tsx`:
- Simple centered card with email and password inputs.
- On submit, call `signIn('credentials', { email, password, callbackUrl: '/' })`.
- Show error message if login fails.

Create `app/(dashboard)/layout.tsx`:
- Sidebar navigation with links: Dashboard, Lists, Campaigns, Settings.
- Settings sub-links: Providers, API Keys.
- Show logged-in email in sidebar footer with sign out button.

### Step 9.2: Dashboard home

Create `app/(dashboard)/page.tsx`:
- Summary cards: Total Lists, Total Contacts, Total Campaigns Sent, Average Open Rate.
- Recent campaigns table (last 5).
- Quick action buttons: "Create List", "New Campaign".

---

## Phase 10: Docker, CI, and Open Source Files

### Step 10.1: Production Docker Compose

Create `docker-compose.prod.yml`:
- Same as `docker-compose.yml` but without the `db` and `minio` services.
- Expects `DATABASE_URL` and all S3 vars to point to external services.
- Add a `migrate` service that runs `db:migrate` and exits before app starts:
  ```yaml
  migrate:
    build: .
    command: node -r tsx/cjs lib/db/migrate.ts
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
  ```

### Step 10.2: GitHub Actions

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx tsc --noEmit

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
```

Create `.github/workflows/docker.yml`:

```yaml
name: Docker
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:latest
```

### Step 10.3: Project documentation files

Create `README.md` with these sections:
1. What it does (2-3 sentences)
2. Screenshots (placeholder for now)
3. Features list
4. Quick start with Docker Compose (copy-paste commands)
5. Environment variables table (variable, description, default)
6. Using AWS S3 instead of MinIO (explain the 3 env var changes)
7. Using hosted Postgres (just change DATABASE_URL)
8. Deployment guides: Railway, Render, Fly.io (with their config file locations)
9. Vercel limitations (no persistent worker, how to work around it)
10. Setting up webhooks for Resend and SES
11. Contributing guide link

Create `CONTRIBUTING.md`:
- Prerequisites (Node 20, Docker)
- Local setup steps
- Branch naming: `feat/`, `fix/`, `docs/`
- PR checklist

Create `CHANGELOG.md` with initial `## [0.1.0] - Unreleased` section.

Create `LICENSE` with MIT license text.

Create `.gitignore` (ensure `.env.local` is included).

---

## Implementation Notes for Claude Code

**Order of operations:**
1. Complete Phase 1 fully before writing any UI. Validate the DB schema, worker, and adapters compile cleanly.
2. Test the worker independently by enqueuing a manual job before building the campaign send UI.
3. Build the upload flow (Phase 2) before the editor (Phase 4) — the list must exist with contacts before a campaign can be previewed with merge tags.
4. The tracking routes (Phase 6) must be deployed at the same `APP_URL` that gets embedded into emails. Do not change `APP_URL` after sending campaigns.

**Error handling pattern:** All internal API routes should return consistent JSON errors:
```typescript
return NextResponse.json({ error: 'Message here' }, { status: 400 })
```

**Pagination pattern:** All list endpoints use `page` and `limit` query params. Default limit is 50. Max limit is 200.

**No em dashes:** Do not use em dashes (`—`) anywhere in UI copy, toast messages, error messages, or comments. Use commas, colons, or rewrite as two sentences.

**Type safety:** All API request bodies must be parsed with Zod before use. Define schemas in `lib/validations/` and import them into both the route handler and any client-side forms.

**Provider config shape:**
- Resend: `{ apiKey: string }`
- SES: `{ apiKey: "ACCESS_KEY_ID:SECRET_KEY", region: string }`
- Store encrypted. Decrypt only in the worker and validate endpoint.