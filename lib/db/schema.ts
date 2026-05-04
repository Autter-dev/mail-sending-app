import {
  pgTable, uuid, text, timestamp, boolean, integer, jsonb, unique, doublePrecision, index
} from 'drizzle-orm/pg-core'

export const lists = pgTable('lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  requireDoubleOptIn: boolean('require_double_opt_in').notNull().default(false),
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
  status: text('status').notNull().default('active'), // active | bounced | unsubscribed | pending
  unsubscribeToken: uuid('unsubscribe_token').notNull().defaultRandom().unique(),
  confirmationToken: uuid('confirmation_token').unique(),
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

export const suppressions = pgTable('suppressions', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  reason: text('reason').notNull(), // bounce | complaint | unsubscribe | manual | imported
  source: text('source'),
  metadata: jsonb('metadata').default({}).$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  rateLimitPerMinute: integer('rate_limit_per_minute').notNull().default(60),
  rateLimitTokens: doublePrecision('rate_limit_tokens').notNull().default(60),
  rateLimitUpdatedAt: timestamp('rate_limit_updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorType: text('actor_type').notNull(), // user | api_key | system
  actorId: text('actor_id'),
  actorLabel: text('actor_label'),
  action: text('action').notNull(),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  metadata: jsonb('metadata').default({}).$type<Record<string, unknown>>(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  createdAtIdx: index('audit_logs_created_at_idx').on(t.createdAt),
  resourceIdx: index('audit_logs_resource_idx').on(t.resourceType, t.resourceId),
}))

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
export type Suppression = typeof suppressions.$inferSelect
export type AuditLog = typeof auditLogs.$inferSelect
