# Contributing to hedwig-mail

Thanks for your interest in contributing. This guide covers the basics for getting set up and submitting changes.

## Prerequisites

- Node.js 20+
- Docker and Docker Compose (for running Postgres and MinIO locally)
- Git

## Local Setup

1. Fork and clone the repository:

```bash
git clone https://github.com/your-username/hedwig-mail.git
cd hedwig-mail
```

2. Install dependencies:

```bash
npm install
```

3. Start infrastructure services:

```bash
docker compose up db minio -d
```

4. Set up the environment:

```bash
cp .env.example .env.local
```

Edit `.env.local` and generate the required secrets:

```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# ENCRYPTION_KEY
openssl rand -hex 32
```

5. Run database migrations:

```bash
npm run db:migrate
```

6. Start the development server and worker:

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run worker
```

7. Open [http://localhost:3000](http://localhost:3000) and log in with the credentials from `.env.local`.

## Branch Naming

Use these prefixes for branches:

- `feat/` for new features (e.g., `feat/export-contacts-csv`)
- `fix/` for bug fixes (e.g., `fix/upload-duplicate-handling`)
- `docs/` for documentation changes (e.g., `docs/api-examples`)

## Making Changes

1. Create a branch from `main`
2. Make your changes
3. Run the linter: `npm run lint`
4. Test your changes locally
5. Commit with a clear message describing what changed and why

## Pull Request Checklist

Before submitting a PR, confirm:

- [ ] Code compiles without errors (`npx tsc --noEmit`)
- [ ] Linter passes (`npm run lint`)
- [ ] New database changes have a migration (`npm run db:generate`)
- [ ] Environment variables are documented in `.env.example` if added
- [ ] No secrets or credentials are committed
- [ ] No em dashes in UI copy or comments (project convention)

## Code Style

- TypeScript strict mode
- All API request bodies validated with Zod
- API routes return `NextResponse.json({ error: '...' }, { status: N })` on failure
- Pagination uses `page` and `limit` query params (default 50, max 200)
- Provider credentials are always encrypted at rest

## Database Changes

If you modify the schema in `lib/db/schema.ts`:

```bash
npm run db:generate   # Creates migration files
npm run db:migrate    # Applies them locally
```

Commit the generated migration files in `drizzle/migrations/`.

## Questions

Open an issue if you have questions or want to discuss a larger change before starting work.
