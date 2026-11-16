# Lead Insight Hub

Lead Insight Hub is the lead intake and follow-up workspace for Boss Mom Consulting. Prospects can submit a business assessment, and the owner can manage leads, review activity, and publish an intake profile.

## Architecture

- **Web app:** React, Vite, Neon Managed Better Auth, hosted on Cloudflare Pages.
- **API:** Express 5 on Node.js 24, hosted on Render; verifies Neon Auth JWTs.
- **Database:** PostgreSQL via Drizzle ORM, hosted on Neon.
- **Email:** Resend sends owner notifications for new leads and consultation requests.
- **Cloudflare Pages Function:** Proxies `/api/*` to Render so browser API requests stay same-origin.

## Run in VS Code

1. Install Node.js 24 and pnpm 10.34.9, then run `pnpm install`.
2. Copy `.env.example` to `.env` and set the Neon database/auth URLs and Resend values.
3. Use **Terminal → Run Task → Start Lead Insight Hub**, or run `pnpm dev` in a terminal.
4. Open `http://localhost:5173`.

The local Vite server proxies `/api/*` to the API on port 5000. `DATABASE_URL` must point to a reachable PostgreSQL database. The API logs a warning and skips email notifications if any Resend setting is missing.

After an assessment is submitted, a prospect can optionally request a 15-minute Zoom or phone consultation. Requests use Pacific Time and the configured weekly windows: Monday, Tuesday, Thursday, and Friday at 8:00–9:30 AM or 2:00–7:00 PM; Saturday and Sunday at 11:00 AM–3:00 PM. A selected time is only a request; the owner can confirm, decline, or offer another time from the lead detail page.

The owner workspace is single-owner: only the preconfigured owner account can sign in, and prospects never need an account to submit an assessment or request a call. Consultation requests appear with their lead and can be confirmed, declined, or answered with a proposed time from the lead detail page.

Useful commands:

- `pnpm run typecheck` — typecheck the workspace.
- `pnpm run build` — typecheck and build all packages.
- `pnpm --filter @workspace/db run push` — update a development database schema.

The local Vite app uses `VITE_NEON_AUTH_URL` for the Neon Auth URL. The API uses `NEON_AUTH_BASE_URL` and `NEON_AUTH_JWKS_URL` to verify short-lived Neon Auth JWTs. For local sign-in, set the Vite URL to the same branch's `NEON_AUTH_BASE_URL`.

## Deploy

### Cloudflare Pages

Connect the repository to Pages with the repository root as the project root. Build with:

```sh
pnpm install --frozen-lockfile && pnpm --filter @workspace/lead-audit-studio run build
```

The output directory is `artifacts/lead-audit-studio/dist/public` (also set in `wrangler.jsonc`). Configure these Pages variables:

- `API_ORIGIN` — the Render service origin, with no path (for example `https://lead-insight-api.onrender.com`).
- `VITE_NEON_AUTH_URL` — the production branch's Neon Auth base URL.

Before enabling sign-in on the deployed site, add its exact origin (scheme and host, no trailing slash) as a trusted origin on the production Neon Auth branch with `neon neon-auth domain add https://app.example.com`. Replace the example with the actual Cloudflare Pages origin; add any preview origins users need as well.

### Render API

Use the included `render.yaml` Blueprint to create the Node web service. Set the generated service's `DATABASE_URL` to a Neon connection string, `NEON_AUTH_BASE_URL` and `NEON_AUTH_JWKS_URL` to the production branch's Neon Auth URLs, `APP_ORIGIN` to the exact Cloudflare Pages origin, and the Resend settings listed below. Render provides `PORT`; the API listens on it and exposes `/api/healthz` for health checks.

### Neon and Resend

Use Neon PostgreSQL and put its connection string in `DATABASE_URL`; Neon connection strings should include SSL mode. Apply schema changes deliberately with Drizzle rather than relying on application startup. The consultation flow adds a booking token to leads and a consultation-request table; the owner follow-up workflow adds response-status and reply fields to that table. Apply schema changes to a development branch first with `pnpm --filter @workspace/db run push`, then apply them to production when ready.

Configure Resend with:

- `RESEND_API_KEY` — API key stored as a deployment secret.
- `RESEND_FROM_EMAIL` — a sender address verified by Resend.
- `RESEND_TO_EMAIL` — the business owner's notification address.

The API sends a notification after a lead or consultation request is stored. Email delivery failures are logged; the assessment result reports when a consultation request was saved but the owner could not be notified.

## Source map

- `artifacts/lead-audit-studio` — customer-facing site and owner workspace.
- `artifacts/api-server` — Express API, Neon Auth JWT verification, lead routes, and email notifications.
- `lib/db` — Drizzle schema and PostgreSQL connection.
- `lib/api-spec` — API contract; generated client and Zod types live in the adjacent packages.
- `functions/api` — Cloudflare Pages same-origin API proxy.
