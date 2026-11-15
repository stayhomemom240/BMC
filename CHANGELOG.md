# Changelog

Times are Pacific local time (America/Los_Angeles, PST / UTC-08:00). Approximate times are marked with `~`.

## 2026-11-14

### Changes and events

- Earlier today (exact time not retained): Added the optional post-assessment consultation request flow, including 15-minute slots, Zoom/phone selection, and owner notification.
- 15:04 — Production database check found one lead; the existing record was not modified.
- 16:40–16:41 — Chose a restart without changing the account email. Restarted the local frontend and API; both returned HTTP 200 on their health/page checks.
- 16:50 — Opened the public intake page. The profile loaded, the three assessment choices appeared, and Continue stayed disabled while required fields were blank.
- 16:51 — A synthetic test submission returned HTTP 500. The lead count did not increase and no notification was sent. At that time, production lacked `lead_audit_leads.public_booking_token` and `lead_audit_consultation_requests`.
- 16:54 — Traced the failure to the production schema not matching the app schema; the previous successful smoke test had used a development branch.
- 16:57–~17:00 — Created `lead-schema-validation-20261114` (`br-silent-resonance-be2i3sv1`) from production, applied the Drizzle schema there, and verified lead-token generation plus a consultation insert in a rolled-back transaction.
- ~17:00 — Drizzle reported “No changes detected” when checked against production. A direct production check then showed both required schema objects present. No production migration was applied by this session; the change that made them appear was not established.
- 17:06 — Stopped further testing after the user reported the intake was working. No additional assessment was submitted.
- 17:08 — Created this changelog.

### Ongoing

- The local app was left running with `pnpm dev` on ports 5173 (frontend) and 5000 (API).
- The temporary validation branch remains pending explicit approval to delete. It is a clone of production with the schema changes applied; the test insert was rolled back.
- The production owner profile was found to match the signed-in owner. Neon Auth reported the email as unverified; the public website profile was unpublished, with no website or Fiverr URL configured.
- The requested account email change was not made; the user chose restart-only.
