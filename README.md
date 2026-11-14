# Lead Insight Hub

Lead Insight Hub is the lead intake and follow-up workspace for Boss Mom Consulting. Prospects can submit a business assessment, and the owner can manage leads, review activity, and publish an intake profile.

## Architecture

- **Web app:** React, Vite, Clerk, hosted on Cloudflare Pages.
- **API:** Express 5 on Node.js 24, hosted on Render.
- **Database:** PostgreSQL via Drizzle ORM, hosted on Neon.
- **Email:** Resend sends owner notifications for newly created leads.
- **Cloudflare Pages Function:** Proxies `/api/*` to Render so browser API and Clerk proxy requests stay same-origin.

## Run in VS Code

1. Install Node.js 24 and pnpm 10.34.9, then run `pnpm install`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`, the Clerk keys, and Resend values.
3. Use **Terminal → Run Task → Start Lead Insight Hub**, or run `pnpm dev` in a terminal.
4. Open `http://localhost:5173`.

The local Vite server proxies `/api/*` to the API on port 5000. `DATABASE_URL` must point to a reachable PostgreSQL database. The API logs a warning and skips email notifications if any Resend setting is missing.

Useful commands:

- `pnpm run typecheck` — typecheck the workspace.
- `pnpm run build` — typecheck and build all packages.
- `pnpm --filter @workspace/db run push` — update a development database schema.

## Deploy

### Cloudflare Pages

Connect the repository to Pages with the repository root as the project root. Build with:

```sh
pnpm install --frozen-lockfile && pnpm --filter @workspace/lead-audit-studio run build
```

The output directory is `artifacts/lead-audit-studio/dist/public` (also set in `wrangler.jsonc`). Configure these Pages variables:

- `API_ORIGIN` — the Render service origin, with no path (for example `https://lead-insight-api.onrender.com`).
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key used by the browser app.
- `VITE_CLERK_PROXY_URL` — the public app origin plus `/api/__clerk`, when Clerk's same-origin proxy is enabled.

### Render API

Use the included `render.yaml` Blueprint to create the Node web service. Set the generated service's `DATABASE_URL` to a Neon connection string, `APP_ORIGIN` to the exact Cloudflare Pages origin, the Clerk keys, and the Resend settings listed below. Render provides `PORT`; the API listens on it and exposes `/api/healthz` for health checks.

### Neon and Resend

Use Neon PostgreSQL and put its connection string in `DATABASE_URL`; Neon connection strings should include SSL mode. Apply schema changes deliberately with Drizzle rather than relying on application startup.

Configure Resend with:

- `RESEND_API_KEY` — API key stored as a deployment secret.
- `RESEND_FROM_EMAIL` — a sender address verified by Resend.
- `RESEND_TO_EMAIL` — the business owner's notification address.

The API sends a notification after a lead is stored. Email delivery failures are logged and do not roll back or duplicate the lead.

## Source map

- `artifacts/lead-audit-studio` — customer-facing site and owner workspace.
- `artifacts/api-server` — Express API, Clerk middleware, lead routes, and email notifications.
- `lib/db` — Drizzle schema and PostgreSQL connection.
- `lib/api-spec` — API contract; generated client and Zod types live in the adjacent packages.
- `functions/api` — Cloudflare Pages same-origin API proxy.
