# Security Policy

Thanks for helping keep hedwig-mail and the people who use it safe.

## Reporting a vulnerability

**Do not file a public GitHub issue for security reports.** A public issue tells everyone, including bad actors, before maintainers can ship a fix.

Instead, report privately one of two ways:

1. **GitHub private vulnerability reporting** (preferred): on the repository, go to the Security tab, then "Report a vulnerability". This opens a private thread visible only to you and the maintainers.
2. **Email**: send details to `sagnik@autter.dev`.

Please include:

- A description of the issue and its impact.
- Steps to reproduce, or a proof of concept.
- The version (commit hash) and deployment shape where you found it.
- Any suggested fix, if you have one.

## What to expect

- We aim to acknowledge reports within 3 business days.
- We will keep you updated as we investigate and prepare a fix.
- Once a fix is released, we credit reporters in the release notes unless you prefer to stay anonymous.

## Scope

In scope:

- The hedwig-mail application code in this repository.
- The Docker images built from this repository.
- Default configurations shipped in `docker-compose.yml` and `docker-compose.prod.yml`.

Out of scope:

- Vulnerabilities in third-party dependencies. Report those upstream. If a dependency CVE affects hedwig-mail in a non-trivial way, we still want to know.
- Self-hosted deployments where the operator misconfigured the environment (for example, running Postgres open to the internet). The production checklist in [SETUP.md](./SETUP.md#production-security-checklist) covers safe defaults.
- Issues in email providers (Resend, SES) or the underlying delivery infrastructure.

## Supported versions

Only the latest release on the `main` branch receives security fixes. If you run an older version, upgrade.

## Hardening guidance

For operators, the production security checklist in [SETUP.md](./SETUP.md#production-security-checklist) lists the safe defaults to confirm before exposing the app to the internet.
