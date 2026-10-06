# Anotto public site, help, and mobile settings roadmap

Status: planned after the email inbox and transaction review flows are stable on web and iOS. This
document does not authorize a domain cutover or publication of legal text.

## Current boundary

- The transactional Next.js app is served at `https://anotto.app` by the existing Vercel project.
  Its callback derives the post-login origin from the request (`app/auth/callback/route.ts`).
- The Worker uses `APP_URL = "https://anotto.app"` for dashboard links in Telegram
  (`spends/wrangler.toml`, `spends/src/handlers/telegram.ts`).
- The mobile profile already links to active documents, email inbox, wealth pages, automation, and
  settings. Placeholder reporting, budgeting, and importing entries were removed on the mobile
  integration branch.

## Delivery order

1. **Help content and contact route.** Define a support address on `anotto.app` and verify delivery
   before displaying it. Write a short FAQ for forwarded email verification, pending versus posted
   transactions, duplicate review, receipts, account balances, and data deletion. Add Help entry
   points to web Settings and mobile Settings. Keep support messages separate from private financial
   records; instruct users to remove account numbers and credentials from attachments.
2. **Mobile security and API keys.** Match the released web settings contract: session/security
   information, key list, create, copy once, and revoke. Use owner-scoped APIs or RPCs; do not put a
   service key in the mobile bundle or persist a newly generated secret in local logs or the offline
   database. Show offline read-only state and require connectivity for mutations.
3. **Transactional subdomain.** Use `app.anotto.app` for the existing Vercel app. Add its DNS and
   Vercel alias, update Supabase redirect allowlists and any Google/OAuth callback settings, verify
   sign-in and email links, and update the Worker's `APP_URL` plus mobile web links. Preserve old
   app URLs with explicit redirects only after callback and deep-link testing. Check auth cookie
   scope so the public site cannot receive app session cookies.
4. **Public landing repository.** Create a separate `anotto-landing` repository and deploy its
   public site to `anotto.app` only after step 3 is live. Reuse the Anotto mark and approved
   neutral/green/amber visual system, with a concise product explanation, supported intake methods,
   pricing or availability if approved, FAQ, support contact, and a clear sign-in link to
   `app.anotto.app`.
5. **Privacy and terms.** Draft English source documents, localize the customer-facing pages, obtain
   owner and legal review, then publish versioned pages on the public site and link them from the
   app, registration, and mobile settings. Record effective dates and a contact route for policy
   questions.

## Release checks

- Existing users can sign in through `app.anotto.app`; password reset, email verification, and OAuth
  callbacks land on the app domain.
- `anotto.app` shows the landing and its sign-in link reaches the app; legacy URLs and Telegram
  dashboard links resolve correctly.
- Web and iOS Help entry points show the same FAQ topics and working support address. API key
  creation and revocation remain owner-scoped and have focused tests.
- Privacy and terms links are visible before account creation and from both settings surfaces; legal
  text is reviewed before publication.

## Decisions to confirm before that phase

- Public app host: default to `app.anotto.app`.
- Support route: default to `soporte@anotto.app`, once mail routing and the receiving team are
  confirmed.
- Landing claims, pricing, and legal contact details: obtain owner-approved copy before publication.
