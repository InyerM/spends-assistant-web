# Anotto web migration and release plan

Status: web released on 2026-10-04. The owner selected Void Emerald with Amber and approved the
customer-facing migration. Mobile follows web verification.

## Definition of done

1. Anotto appears consistently in browser metadata, favicon, authentication, navigation, help,
   guided email forwarding, and other customer-facing copy in English, Spanish, and Portuguese.
2. Shared tokens and controls implement `DESIGN.md`; each major web route uses the same visual
   hierarchy while preserving its existing task and data.
3. Financial data flow remains intact: document observations require review, duplicates remain
   visible, posting requires approval, and investment/debt journals retain transaction links.
4. Full tests, typecheck, lint, production build, and desktop/mobile visual checks pass.
5. A production deployment serves the verified version. `anotto.app` is connected only after its
   DNS, certificate, auth redirects, and receipt forwarding behavior are checked.

## Work packages and ownership

| Package                 | Main files                                                                 | Acceptance                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Foundation              | `app/globals.css`, `app/layout.tsx`, `components/ui/`                      | Semantic tokens, Manrope, white action, neutral surfaces, emerald and amber roles, accessible states.                |
| Identity and shell      | `components/layout/`, auth pages, `app/icon.svg`, `messages/`              | Three-bar wordmark, Anotto copy, consistent desktop/mobile navigation, localized auth and forwarding.                |
| Dashboard               | dashboard page and `components/dashboard/`                                 | Real balances and activity retain data source; visual hierarchy follows the chosen concept without fabricated facts. |
| Transactions            | transaction pages and `components/transactions/`                           | Filters, lists, editing, import, review, and document upload remain legible and functional.                          |
| Evidence and operations | document, account, category, automation, settings routes and components    | Intake/review/posting boundaries remain clear; shared controls and accessible states are reused.                     |
| Wealth journals         | investment, loan, receivable, and relief-fund routes; `components/wealth/` | History, source links, and review confirmation remain intact and visually consistent.                                |
| Integration             | backend customer-facing Telegram text, domain and forwarding configuration | Visible name changes only; internal names and existing receipt address remain stable.                                |

Agents own nonoverlapping file groups in the shared worktree. The coordinator reviews all diffs,
integrates tests, captures browser evidence, and commits the final web change. Shared design tokens
are established before route-specific polish.

## Migration sequence

1. Record approved product and design decisions in `PRODUCT.md` and `DESIGN.md`.
2. Land foundation and shell, then apply to dashboard, transactions, evidence, and wealth pages.
3. Search customer-visible sources for legacy names; leave internal package, API, database,
   migration, repository, and Worker identifiers unchanged.
4. Run focused route tests during implementation; run full web checks after all agents finish.
5. Inspect representative authenticated routes at desktop and phone widths. Review dark contrast,
   long Spanish strings, dialogs, list density, focus, and touch targets. Fix material issues in a
   bounded batch and capture final screenshots.
6. Deploy the tested web commit to Vercel. Preserve the old domain and its access until the new
   address passes a live smoke test.
7. Add `anotto.app` as a Vercel project domain, update Cloudflare DNS, verify the TLS certificate,
   login redirects, session behavior, and email forwarding before making it the canonical address.
8. Apply the approved identity to mobile after the web release is confirmed; preserve mobile
   application identifiers and existing offline data.

## Release evidence

- Web commit `d4782fe` passed 853 tests in 111 suites, typecheck, lint (one existing React Hook Form
  compiler warning), formatting, and a production build on 2026-10-04. The Vercel production
  deployment is `dpl_7shWmWJjFQN7aQwqVq13fmkDCY5p`.
- Browser checks used fictional fixture data at 1440×900 and 390×844. The dashboard had no
  horizontal overflow; the mobile navigation sheet was also inspected at 667×375. Login and
  registration were checked at desktop and phone widths. The temporary fixture route was removed.
- `https://anotto.app/login` and `https://www.anotto.app/login` returned HTTP 200 over HTTPS with
  the Anotto title; the new icon returned HTTP 200; unauthenticated `/dashboard` redirected to
  `/login`. Vercel issued certificates for both hostnames. The former web hostname also serves the
  new release and remains available.
- Supabase Auth Site URL is `https://anotto.app`; the new apex and www callback/settings URLs and
  former hostname callback/settings URLs are in its redirect allow list. Existing entries remain.
- The Worker was deployed as version `e6334dcd-cc7d-4665-8bc2-ac3f0d3fefd6` with its existing
  internal name and forwarding domain. Its public `APP_URL` now points to `https://anotto.app`.

Authenticated end-to-end actions were not exercised against production because no test user session
was available. The owner should verify sign-in, financial review, and forwarding on the live site
before the old web hostname is redirected or mobile styling is released.

## Domain history and gate

On 2026-10-03, public NS records for `anotto.app` pointed to Cloudflare, while the root URL still
served a Hostinger parked-domain page. The backend `.env.local` contains a Cloudflare API token; its
verification endpoint returned `active`, and the `anotto.app` zone is active. The current apex
record points to the parked site and `www` aliases the apex. The Vercel project
`spends-assistant-web` is accessible; its current production URL is `spends-assistant.inyerm.com`.
After the tested build was deployed, Vercel recommended `76.76.21.21`. The Cloudflare apex A record
was changed to that address and set to DNS-only. The www CNAME still points to the apex and was also
set to DNS-only. Neither the receipt hostname nor mail records were changed.

Do not point receipts or existing bank-email forwarding at `anotto.app` as part of the website
cutover. Keep the current receipt address operational and test Gmail forwarding separately.

## Verification and rollback

- Run `pnpm test:run`, `pnpm typecheck`, `pnpm lint`, `pnpm format`, and `pnpm build` after
  integration.
- Check the key flows on the deployed site: sign-in, dashboard, transactions, document review,
  email-forwarding settings, investments, loans, receivables, and relief funds.
- Confirm the version under the old hostname before updating the new domain. If the new domain
  fails, keep the old hostname serving the verified deployment and restore the previous DNS record.
- Do not change database records or internal identifiers for branding. Rollback is therefore a web
  deployment/DNS operation, not a data migration.
