# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - Unreleased

### Added

- Project scaffold with Next.js 14, Drizzle ORM, pg-boss, and Tailwind CSS
- Contact list management with CSV/XLSX import and column mapping
- Email provider integration (Resend and Amazon SES) with encrypted credential storage
- Visual block email editor with drag-and-drop, live preview, and merge tags
- Campaign creation, sending, scheduling, and cancellation
- Open tracking (pixel) and click tracking (link wrapping) with per-campaign analytics
- Unsubscribe page with one-click opt-out and List-Unsubscribe header support
- Public REST API with Bearer token authentication
- API key management in the dashboard
- Webhook receivers for Resend and SES bounce/complaint notifications
- Dashboard with summary stats and recent campaigns
- Docker Compose setup for local development (Postgres, MinIO, app, worker)
- Production Dockerfile with standalone Next.js output
