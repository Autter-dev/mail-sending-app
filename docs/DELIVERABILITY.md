# Deliverability and Hostname Layout

This guide covers the production hostname split, Railway configuration, and
AWS SES setup for getting email out of spam and avoiding Safe Browsing flags.

## Why three hostnames

The app is designed to run on three subdomains of the same apex domain:

| Hostname | Purpose | What it serves |
| --- | --- | --- |
| `app.example.com` | Dashboard + login | Everything except `/r/`, `/t/`, `/unsubscribe/` |
| `send.example.com` | `From:` address | No HTTP routes; lives in DNS only |
| `track.example.com` | Click + open + unsubscribe | Only `/r/`, `/t/`, `/unsubscribe/`, `/api/webhooks/*` |

Why split them:

- **Reputation isolation.** Spam complaints or Safe Browsing flags on tracked
  links stay on `track.`. The dashboard at `app.` keeps a clean reputation,
  and the sending domain at `send.` keeps a clean reputation.
- **Phishing classifier shape.** A single hostname that sends bulk email,
  hosts a login form, and serves an open-redirect-shaped URL looks identical
  to a phishing kit. Splitting breaks that pattern.
- **DKIM alignment.** SES signs DKIM with the domain you verify. Keep that
  domain dedicated to sending so policy changes don't affect the dashboard.

The same Next.js app serves all three hosts. Middleware locks `track.` down
to tracking endpoints only — anything else 404s.

## Required environment variables

```bash
# Dashboard
APP_URL=https://app.example.com
NEXTAUTH_URL=https://app.example.com

# Tracking (separate host)
TRACKING_URL=https://track.example.com

# HMAC secret for click-tracking links. If unset, falls back to ENCRYPTION_KEY.
TRACKING_SECRET=<openssl rand -hex 32>
```

`From:` addresses are configured per campaign or per provider, so there is no
env var for `send.example.com` — you just set the From email to
`hello@send.example.com` (or similar) in the campaign editor.

## Railway setup

1. **Custom domains.** In your Railway service settings, add both:
   - `app.example.com`
   - `track.example.com`

   Railway will give you a CNAME target for each. Add those CNAMEs at your DNS
   provider. Both point at the same Railway service.

2. **Environment variables.** Set on the service:

   ```
   APP_URL=https://app.example.com
   NEXTAUTH_URL=https://app.example.com
   TRACKING_URL=https://track.example.com
   TRACKING_SECRET=<openssl rand -hex 32>
   ```

   Apply the same variables to the worker service if you run it separately.

3. **Verify the lockdown.** After deploy, hitting `https://track.example.com/login`
   should return 404. Hitting `https://track.example.com/t/00000000-0000-0000-0000-000000000000`
   should return a 1x1 GIF.

4. **Existing campaign URLs.** Links in already-sent emails contain the old
   unsigned format and will redirect to `/` after the upgrade. Once you cut over,
   click-through on past campaigns is lost. Plan the cutover after a quiet
   sending window.

## AWS SES setup for `send.example.com`

The goal is full SPF + DKIM + DMARC alignment so Gmail and Outlook trust mail
from this domain.

### 1. Verify the domain in SES

In the SES console (matching the region in your provider config):

1. **Identities → Create identity → Domain.**
2. Enter `send.example.com`.
3. Enable **Easy DKIM** (RSA 2048-bit).
4. SES gives you **3 CNAME records**, one per DKIM selector. Add all three to
   DNS. Wait for SES to flip the verification status to **Verified**
   (usually a few minutes).

### 2. Configure a custom MAIL FROM domain (for SPF alignment)

In the SES identity:

1. Open `send.example.com` → **Authentication → Edit MAIL FROM domain**.
2. Set MAIL FROM to `mail.send.example.com`.
3. SES gives you 2 records:
   - `mail.send.example.com MX 10 feedback-smtp.<region>.amazonses.com`
   - `mail.send.example.com TXT "v=spf1 include:amazonses.com ~all"`
4. Add both to DNS.

This makes SPF align with the `From:` domain (required for DMARC pass).

### 3. Add DMARC

Add a TXT record at the apex:

```
_dmarc.example.com TXT "v=DMARC1; p=none; rua=mailto:dmarc@example.com; pct=100; aspf=r; adkim=r"
```

Start with `p=none` to monitor, then move to `p=quarantine` and finally
`p=reject` once you're confident nothing legitimate is failing alignment.

### 4. Move out of the SES sandbox

By default new SES accounts can only send to verified addresses. Open
**Account dashboard → Request production access** and submit. Approval is
usually under 24 hours.

### 5. Hook up bounce + complaint webhooks (SNS → app)

Bounces and complaints must come back to the app so suppressions auto-populate.

1. **SNS → Topics → Create topic** named `ses-events`.
2. **SES → Configuration sets → Create configuration set**, then attach an
   event destination to the SNS topic for `Bounce`, `Complaint`, and
   optionally `Reject`/`RenderingFailure`.
3. **SNS → Subscriptions → Create subscription**:
   - Protocol: HTTPS
   - Endpoint: `https://track.example.com/api/webhooks/ses`

   The handler at `app/api/webhooks/ses/route.ts` auto-confirms the SNS
   subscription on the first POST.

4. In each campaign provider in the dashboard, set the **Configuration set
   name** field so SES tags outgoing mail with this configuration set.

### 6. Enable engagement tracking on the SES side (optional)

If you want SES-level open and click tracking in addition to the in-app
tracker, enable it on the configuration set. Skip if the in-app tracker is
sufficient.

## In the dashboard

1. **Settings → Providers → Add provider** (SES).
   - Region: matches the verified domain
   - Access key + secret: an IAM user limited to `ses:SendEmail`,
     `ses:SendRawEmail`, `ses:GetSendQuota`
2. Click **Validate Connection**, then **Set as Default**.
3. In the campaign editor, set the From address to `something@send.example.com`.

## Verification checklist before sending

```bash
# DKIM CNAMEs resolve
dig +short cname <selector1>._domainkey.send.example.com

# MAIL FROM SPF
dig +short txt mail.send.example.com

# DMARC
dig +short txt _dmarc.example.com

# Tracker is locked down
curl -i https://track.example.com/login        # expect 404
curl -i https://track.example.com/t/00000000-0000-0000-0000-000000000000  # expect 200 image/gif

# Dashboard works
curl -i https://app.example.com/login          # expect 200 HTML
```

Send a test campaign to a Gmail address you control and check
**Show original** → all of `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`.

## If you still land in spam after this

1. **Warm up.** Send < 50/day for the first week, ramp gradually. Cold-blasting
   thousands from a brand-new domain is a guaranteed spam trip.
2. **Engagement.** Inbox providers learn from opens and replies. Send to
   engaged contacts first.
3. **Content.** Avoid image-only emails, all-caps subjects, urgent/scammy
   copy, and link shorteners.
4. **Suppress aggressively.** Bounces and complaints feed the suppression
   list automatically (via the SES webhook). Make sure the webhook is firing.

## Recovering from a Safe Browsing flag

If a hostname has already been flagged:

1. Take the redirector and pixel off that hostname (set `TRACKING_URL` to a
   new, clean subdomain).
2. Wait for at least one Googlebot recrawl.
3. Submit a review at https://safebrowsing.google.com/safebrowsing/report_error/
   for the old hostname.

The new hostname starts with no flag. Don't reuse the old name for sending
even after it's cleared — reputation lingers.
