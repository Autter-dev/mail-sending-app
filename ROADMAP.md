# Roadmap Todo List

Features needed to make this a complete end-to-end email marketing suite for organizations. Phases 1-8 (broadcast MVP) are already shipped: lists, providers, block editor, campaigns, open/click tracking, unsubscribe, and public REST API.

## P0, Critical

- [ ] **Global suppression list** [Effort: M]: Centralized record of every email that should never be sent to, regardless of which list they appear on. Auto-populated from bounces, complaints, and unsubscribes. Importable from CSV to seed historical suppressions.
- [ ] **Provider rate limit enforcement** [Effort: S]: Honor the per-second send limit configured on each provider. Currently the schema has the field but the worker ignores it.
- [ ] **Domain authentication UI** [Effort: L]: Guided setup for SPF, DKIM, and DMARC. Generate provider-specific DKIM keys, display the DNS records the user must add, poll DNS for verification, and block sending from unverified domains.
- [ ] **Plain-text alternative auto-generation** [Effort: S]: Automatically generate a text version of every HTML email. Improves deliverability and accessibility.
- [ ] **GDPR data export and delete** [Effort: M]: Per-contact export of all stored data and a hard delete that purges across every table. Required for "right to be forgotten" requests.
- [ ] **Audit log** [Effort: M]: Append-only record of who did what and when across the system. Foundation for any compliance conversation and required by RBAC.

## P1, High Impact

- [ ] **Typed custom contact fields** [Effort: M]: Per-list field definitions with types (text, number, date, boolean) instead of freeform JSON metadata. Enables validation, filtering, and personalization with proper data types.
- [ ] **Tags on contacts** [Effort: S]: Lightweight, multi-valued labels that can be applied to contacts manually or by automations. Used as filters in segments and as triggers in workflows.
- [ ] **Segments** [Effort: M]: Saved filter queries against a list (e.g. "opened anything in the last 30 days, country = US"). Used as a campaign target instead of an entire list. Can be combined with tags, fields, and engagement signals.
- [ ] **Double opt-in** [Effort: M]: Per-list toggle that requires new contacts to confirm via emailed link before being marked active. Confirmation page and token-based confirmation flow.
- [ ] **Embeddable signup forms** [Effort: M]: Form builder, hosted form pages, and a JS embed snippet. Submissions flow into a list and respect double opt-in if enabled.
- [ ] **Saved templates library** [Effort: S]: Reusable templates with thumbnails. Save any campaign as a template, start new campaigns from any template.
- [ ] **Asset library** [Effort: M]: Central image and file manager. Upload once, browse and drop into any campaign editor. Replaces per-campaign image uploads.
- [ ] **A/B testing** [Effort: M]: Subject line and content variants on a campaign. Send variants to a test sample, pick the winner by open or click rate, and send the winner to the rest.
- [ ] **Reply-to and reply forwarding** [Effort: S]: Configurable reply-to address per campaign with optional forwarding to a real mailbox. Avoids no-reply senders without building a full inbox.
- [ ] **Transactional API and templates** [Effort: M]: Endpoint for high-volume one-off sends like password resets and receipts, using stored templates with variable substitution. Bypasses the campaign and list machinery and reports separately.
- [ ] **Geo, device, and client breakdowns** [Effort: M]: Open and click events broken down by country, device type, and email client. Built on the existing campaign events table plus IP geolocation and user-agent parsing.
- [ ] **Conversion tracking** [Effort: M]: Define conversion goals (URL hits, custom events) and attribute them back to the campaign that drove them. Conversion rate alongside open and click rate.
- [ ] **Deliverability dashboard** [Effort: M]: Aggregate bounce, complaint, and unsubscribe rates over time, broken down by domain (Gmail, Outlook, Yahoo). Surface trends before they become reputation problems.
- [ ] **Outbound webhooks** [Effort: M]: Customer-defined endpoints receive HMAC-signed POSTs on send, open, click, bounce, complaint, and unsubscribe events. Retry queue for failed deliveries.
- [ ] **Multi-user with roles (RBAC)** [Effort: L]: Replace the single admin env credential with real users, invitations, and roles (Owner, Admin, Editor, Viewer). Permission checks on every mutating route.

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
