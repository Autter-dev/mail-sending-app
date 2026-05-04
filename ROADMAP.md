# Roadmap Todo List

## Why API access matters

The public REST API turns this from a standalone marketing tool into a piece of infrastructure that other systems can plug into. Concretely, exposing a well-shaped API unlocks:

- **Product-driven contact sync**: the user's app server pushes new signups, profile updates, and lifecycle changes into lists in real time, instead of relying on CSV imports.
- **Behavioral triggers**: the user's app emits custom events (`order_placed`, `trial_expiring`, `feature_used`) that segments and drip workflows can target, making email reactive to product state rather than batch-only.
- **Transactional sends from any service**: password resets, receipts, and notifications go through the same domain auth, suppression, and analytics as marketing email, instead of a separate vendor.
- **Headless authoring and reporting**: internal tools, dashboards, and ops scripts can manage lists, fetch campaign stats, and trigger sends without using the dashboard UI.
- **Customer-facing automation**: outbound webhooks let downstream systems react to email events (sync opens to a CRM, push unsubscribes to a data warehouse, alert on bounces).
- **Self-service for technical users**: developer teams adopt the tool faster when they can integrate it with a few API calls instead of a long onboarding flow.

The features below build out the API surface so it's safe, observable, and complete enough to be the primary integration point.

## P0, Critical

- [ ] **Global suppression list** [Effort: M]: Centralized record of every email that should never be sent to, regardless of which list they appear on. Auto-populated from bounces, complaints, and unsubscribes. Importable from CSV to seed historical suppressions.
- [ ] **Provider rate limit enforcement** [Effort: S]: Honor the per-second send limit configured on each provider. Currently the schema has the field but the worker ignores it.
- [ ] **Domain authentication UI** [Effort: L]: Guided setup for SPF, DKIM, and DMARC. Generate provider-specific DKIM keys, display the DNS records the user must add, poll DNS for verification, and block sending from unverified domains.
- [ ] **Plain-text alternative auto-generation** [Effort: S]: Automatically generate a text version of every HTML email. Improves deliverability and accessibility.
- [ ] **GDPR data export and delete** [Effort: M]: Per-contact export of all stored data and a hard delete that purges across every table. Required for "right to be forgotten" requests.
- [ ] **Audit log** [Effort: M]: Append-only record of who did what and when across the system. Foundation for any compliance conversation and required by RBAC.
- [ ] **Per-key API rate limiting** [Effort: S]: Token-bucket limit applied per API key with standard `X-RateLimit-*` response headers and 429 responses on overage. Prevents a runaway integration from saturating the worker or the upstream provider.
- [ ] **Scoped API keys** [Effort: S]: Per-key permissions (read-only, contacts-only, campaigns-only, transactional-only) instead of all-or-nothing access. Keys carry a scope string set at creation; route handlers check it. Lets users hand out narrow keys to scripts and third parties.

## P1, High Impact

- [ ] **Typed custom contact fields** [Effort: M]: Per-list field definitions with types (text, number, date, boolean) instead of freeform JSON metadata. Enables validation, filtering, and personalization with proper data types.
- [ ] **Tags on contacts** [Effort: S]: Lightweight, multi-valued labels that can be applied to contacts manually or by automations. Used as filters in segments and as triggers in workflows.
- [ ] **Segments** [Effort: M]: Saved filter queries against a list (e.g. "opened anything in the last 30 days, country = US"). Used as a campaign target instead of an entire list. Can be combined with tags, fields, and engagement signals.
- [x] **Saved templates library** [Effort: S]: Reusable templates with thumbnails. Save any campaign as a template, start new campaigns from any template.
- [x] **Double opt-in** [Effort: M]: Per-list toggle that requires new contacts to confirm via emailed link before being marked active. Confirmation page and token-based confirmation flow.
- [x] **Embeddable signup forms** [Effort: M]: Form builder, hosted form pages, and a JS embed snippet. Submissions flow into a list and respect double opt-in if enabled.
- [ ] **Asset library** [Effort: M]: Central image and file manager. Upload once, browse and drop into any campaign editor. Replaces per-campaign image uploads.
- [ ] **A/B testing** [Effort: M]: Subject line and content variants on a campaign. Send variants to a test sample, pick the winner by open or click rate, and send the winner to the rest.
- [ ] **Reply-to and reply forwarding** [Effort: S]: Configurable reply-to address per campaign with optional forwarding to a real mailbox. Avoids no-reply senders without building a full inbox.
- [ ] **Transactional API and templates** [Effort: M]: Endpoint for high-volume one-off sends like password resets and receipts, using stored templates with variable substitution. Bypasses the campaign and list machinery and reports separately.
- [ ] **Geo, device, and client breakdowns** [Effort: M]: Open and click events broken down by country, device type, and email client. Built on the existing campaign events table plus IP geolocation and user-agent parsing.
- [ ] **Conversion tracking** [Effort: M]: Define conversion goals (URL hits, custom events) and attribute them back to the campaign that drove them. Conversion rate alongside open and click rate.
- [ ] **Deliverability dashboard** [Effort: M]: Aggregate bounce, complaint, and unsubscribe rates over time, broken down by domain (Gmail, Outlook, Yahoo). Surface trends before they become reputation problems.
- [ ] **Outbound webhooks** [Effort: M]: Customer-defined endpoints receive HMAC-signed POSTs on send, open, click, bounce, complaint, and unsubscribe events. Retry queue for failed deliveries.
- [ ] **Multi-user with roles (RBAC)** [Effort: L]: Replace the single admin env credential with real users, invitations, and roles (Owner, Admin, Editor, Viewer). Permission checks on every mutating route.
- [ ] **Custom events ingestion API** [Effort: M]: `POST /api/v1/events` to record arbitrary product events tied to a contact (`order_placed`, `feature_used`). Stored on a new events table and queryable from segments and workflow triggers. Turns the tool from list-based to behavior-based.
- [ ] **OpenAPI spec and hosted docs** [Effort: M]: Generate a versioned OpenAPI document from the existing Zod schemas using `@anatine/zod-openapi` (already in dependencies) and serve interactive docs at `/api/docs`. Required for any serious developer adoption.
- [ ] **Idempotency keys** [Effort: S]: Honor an `Idempotency-Key` header on all mutating API routes. Replay-safe inserts and sends so retries from customer code don't create duplicates.
- [ ] **Cursor-based pagination** [Effort: S]: Add `cursor` and `next_cursor` to list endpoints alongside the existing `page`/`limit`. Stable for large datasets and incremental sync use cases where offset pagination misses or duplicates rows.
- [ ] **Bulk async operations API** [Effort: M]: Long-running endpoints (bulk import, bulk update, bulk delete, large exports) return a job id immediately and a status endpoint reports progress and a download URL. Avoids HTTP timeouts on jobs over a few thousand contacts.

## P2, Expansion

- [ ] **List deduplication and merge** [Effort: M]: Detect duplicate contacts within or across lists and merge them with conflict resolution rules.
- [ ] **Email validation on import** [Effort: M]: Syntax and MX record check during CSV import; optional integration with a validation provider (ZeroBounce, NeverBounce). Mark addresses as risky before they pollute the list.
- [ ] **Preference center** [Effort: M]: Branded page where contacts choose which lists or topics to subscribe to, instead of a hard unsubscribe. Reduces churn from broad opt-outs.
- [ ] **Locale-aware templates** [Effort: M]: Templates with locale variants. A merge tag selects the body based on the contact's locale field.
- [ ] **Inbox preview and spam scoring** [Effort: L]: Render the email across major inbox clients (Gmail, Outlook, Apple Mail) and run it through a spam filter before send. Surface warnings inline in the editor.
- [ ] **Send-time optimization and timezones** [Effort: L]: Per-contact timezone tracking. Schedule a campaign once and have it deliver at the same local time per recipient. Optional "best historical hour" optimization based on past opens.
- [ ] **Drip workflows** [Effort: L]: Visual workflow builder with triggers (contact added, tag applied, custom event, date field reached) and actions (send email, wait, add or remove tag, branch on opened or clicked). Per-contact state machine.
- [ ] **Per-link click heatmap** [Effort: M]: Visual overlay on the rendered email showing which links got the most clicks.
- [ ] **CRM and data warehouse sync** [Effort: L]: Native connectors or scheduled exports to common CRMs (HubSpot, Salesforce) and warehouses (Postgres, BigQuery, Snowflake) for two-way contact sync and event streaming.
- [ ] **Official SDKs** [Effort: L]: Maintained client libraries for Node/TypeScript, Python, and Go generated from the OpenAPI spec, with typed responses, retry, and idempotency built in. Drops integration time from hours to minutes.
- [ ] **API usage dashboard** [Effort: M]: Per-key breakdown of request volume, error rate, latency, and rate-limit hits over time. Lets users debug their own integrations without reading server logs.
- [ ] **Public browser-safe events endpoint** [Effort: M]: CORS-enabled `POST /api/v1/public/events` authenticated with a publishable (write-only, contact-scoped) key, so client-side code can record events directly without proxying through the user's backend. Mirrors the pattern PostHog and Segment use.

## Additional Email Providers

Today only Resend and AWS SES are supported. The adapter contract in `lib/providers/types.ts` is built for extension, so adding a provider is mostly: implement `EmailProviderAdapter`, register it in `lib/providers/factory.ts`, and add a config form in the providers settings UI. Each provider unlocks a different deliverability profile, price point, or geography.

- [ ] **Generic SMTP** [Effort: S]: Catch-all adapter using `nodemailer` with host, port, username, password, and TLS options. Lets users connect to any provider that exposes SMTP (Postmark, Mailgun, Mailjet, self-hosted Postfix, Google Workspace relay, Microsoft 365). Single highest-leverage addition because it covers most providers without a dedicated adapter.
- [ ] **SendGrid** [Effort: S]: Twilio's high-volume sender. Strong reputation tooling, dedicated IPs, deep webhook support. Good fit for marketing teams already on Twilio.
- [ ] **Mailgun** [Effort: S]: Developer-focused with strong EU region support. Good deliverability and detailed event logs. Native HTTP API and SMTP both available.
- [ ] **Postmark** [Effort: S]: Premium transactional sender with separate streams for transactional vs broadcast email. Excellent inbox placement and very fast bounce/complaint feedback. Pairs well with the transactional API feature.
- [ ] **Brevo (formerly Sendinblue)** [Effort: S]: European provider with generous free tier. Popular for SMB users and EU-data-residency requirements.
- [ ] **SparkPost** [Effort: M]: High-volume sender owned by MessageBird. Strong analytics API and inbox placement reporting. Good fit for users scaling past free Resend tiers.
- [ ] **Mailjet** [Effort: S]: French provider with strong EU compliance positioning and transactional + marketing modes.
- [ ] **Mailtrap** [Effort: S]: Sandbox by default for staging environments, with a production sending option. Useful as a dev/staging provider so test sends never hit real inboxes.
- [ ] **SMTP2GO** [Effort: S]: Pay-as-you-go relay with global infrastructure and a thin API. Common pick for users who want a simple alternative to SES without AWS overhead.
- [ ] **Amazon Pinpoint** [Effort: M]: AWS's higher-level marketing service that wraps SES with segmentation and journeys. Worth offering for users already deep in AWS who want SES-grade delivery with extra reporting.
- [ ] **Google Workspace / Microsoft 365 (OAuth)** [Effort: L]: OAuth-authorized sending through a user's own Gmail or Outlook account, for low-volume users who want messages to come from a real mailbox they already own. Different auth model from API-key providers, so deserves its own adapter.
- [ ] **Provider failover and routing rules** [Effort: M]: Configure multiple providers and route by rules (sender domain, list, priority) with automatic failover when a provider returns errors or hits rate limits. Turns providers from a single-pick setting into a deliverability strategy.
