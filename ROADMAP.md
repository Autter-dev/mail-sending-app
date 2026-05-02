# Roadmap

Features needed to make this a complete end-to-end email marketing suite for organizations. Phases 1-8 (broadcast MVP) are already shipped: lists, providers, block editor, campaigns, open/click tracking, unsubscribe, and public REST API.

---

## Contact and Audience

- [ ] **Global suppression list**
  Centralized record of every email that should never be sent to, regardless of which list they appear on. Auto-populated from bounces, complaints, and unsubscribes. Importable from CSV to seed historical suppressions.

- [ ] **Typed custom contact fields**
  Per-list field definitions with types (text, number, date, boolean) instead of freeform JSON metadata. Enables validation, filtering, and personalization with proper data types.

- [ ] **Tags on contacts**
  Lightweight, multi-valued labels that can be applied to contacts manually or by automations. Used as filters in segments and as triggers in workflows.

- [ ] **Segments**
  Saved filter queries against a list (e.g. "opened anything in the last 30 days, country = US"). Used as a campaign target instead of an entire list. Can be combined with tags, fields, and engagement signals.

- [ ] **List deduplication and merge**
  Detect duplicate contacts within or across lists and merge them with conflict resolution rules.

- [ ] **Email validation on import**
  Syntax and MX record check during CSV import; optional integration with a validation provider (ZeroBounce, NeverBounce). Mark addresses as risky before they pollute the list.

- [ ] **Double opt-in**
  Per-list toggle that requires new contacts to confirm via emailed link before being marked active. Confirmation page and token-based confirmation flow.

- [ ] **Preference center**
  Branded page where contacts choose which lists or topics to subscribe to, instead of a hard unsubscribe. Reduces churn from broad opt-outs.

- [ ] **Embeddable signup forms**
  Form builder, hosted form pages, and a JS embed snippet. Submissions flow into a list and respect double opt-in if enabled.

- [ ] **GDPR data export and delete**
  Per-contact export of all stored data and a hard delete that purges across every table. Required for "right to be forgotten" requests.

---

## Authoring and Content

- [ ] **Saved templates library**
  Reusable templates with thumbnails. Save any campaign as a template, start new campaigns from any template.

- [ ] **Asset library**
  Central image and file manager. Upload once, browse and drop into any campaign editor. Replaces per-campaign image uploads.

- [ ] **Plain-text alternative auto-generation**
  Automatically generate a text version of every HTML email. Improves deliverability and accessibility.

- [ ] **Locale-aware templates**
  Templates with locale variants. A merge tag selects the body based on the contact's locale field.

- [ ] **Inbox preview and spam scoring**
  Render the email across major inbox clients (Gmail, Outlook, Apple Mail) and run it through a spam filter before send. Surface warnings inline in the editor.

---

## Sending and Deliverability

- [ ] **Provider rate limit enforcement**
  Honor the per-second send limit configured on each provider. Currently the schema has the field but the worker ignores it.

- [ ] **Domain authentication UI**
  Guided setup for SPF, DKIM, and DMARC. Generate provider-specific DKIM keys, display the DNS records the user must add, poll DNS for verification, and block sending from unverified domains.

- [ ] **Send-time optimization and timezones**
  Per-contact timezone tracking. Schedule a campaign once and have it deliver at the same local time per recipient. Optional "best historical hour" optimization based on past opens.

- [ ] **A/B testing**
  Subject line and content variants on a campaign. Send variants to a test sample, pick the winner by open or click rate, and send the winner to the rest.

- [ ] **Reply-to and reply forwarding**
  Configurable reply-to address per campaign with optional forwarding to a real mailbox. Avoids no-reply senders without building a full inbox.

---

## Automation

- [ ] **Drip workflows**
  Visual workflow builder with triggers (contact added, tag applied, custom event, date field reached) and actions (send email, wait, add or remove tag, branch on opened or clicked). Per-contact state machine.

- [ ] **Transactional API and templates**
  Endpoint for high-volume one-off sends like password resets and receipts, using stored templates with variable substitution. Bypasses the campaign and list machinery and reports separately.

---

## Access Control and Compliance

- [ ] **Multi-user with roles (RBAC)**
  Replace the single admin env credential with real users, invitations, and roles (Owner, Admin, Editor, Viewer). Permission checks on every mutating route.

- [ ] **Audit log**
  Append-only record of who did what and when across the system. Foundation for any compliance conversation and required by RBAC.

---

## Analytics and Reporting

- [ ] **Geo, device, and client breakdowns**
  Open and click events broken down by country, device type, and email client. Built on the existing campaign events table plus IP geolocation and user-agent parsing.

- [ ] **Per-link click heatmap**
  Visual overlay on the rendered email showing which links got the most clicks.

- [ ] **Conversion tracking**
  Define conversion goals (URL hits, custom events) and attribute them back to the campaign that drove them. Conversion rate alongside open and click rate.

- [ ] **Deliverability dashboard**
  Aggregate bounce, complaint, and unsubscribe rates over time, broken down by domain (Gmail, Outlook, Yahoo). Surface trends before they become reputation problems.

---

## Integrations

- [ ] **Outbound webhooks**
  Customer-defined endpoints receive HMAC-signed POSTs on send, open, click, bounce, complaint, and unsubscribe events. Retry queue for failed deliveries.

- [ ] **CRM and data warehouse sync**
  Native connectors or scheduled exports to common CRMs (HubSpot, Salesforce) and warehouses (Postgres, BigQuery, Snowflake) for two-way contact sync and event streaming.
