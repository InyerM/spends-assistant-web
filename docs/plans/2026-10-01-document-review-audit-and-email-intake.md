# Document review audit and email intake plan

Status: document review changes are implemented locally and require the normal release gates. Gmail
connection is a design proposal; no mailbox connection, OAuth credential, forwarding rule, or
automatic import has been created.

Release check on 2026-10-01: the linked Supabase project `zptcolhwonzvaxevyxuj` rejected the
available database credential with `28P01`, and the local Management API token did not list that
project. The document lifecycle migration is therefore unapplied remotely. Do not deploy the web
release until project access is restored, the migration is applied, and the browser checks below
pass.

## Evidence and current boundaries

- The web repository's `CLAUDE.md` requires React Query for data access, shared UI controls, and
  components of roughly 200 lines. Before this change, `app/(dashboard)/documents/page.tsx` and
  `components/documents/document-batch-review.tsx` used direct browser `fetch`, native selectors,
  and a second transaction editor. The document page now queries through
  `lib/api/queries/document.queries.ts`, writes through `lib/api/mutations/document.mutations.ts`,
  and both document editors use `components/documents/document-review-fields.tsx`. The page and
  batch controller are still large; extract their state machines before adding more document types.
- `app/(dashboard)/loans/page.tsx`, `investments/page.tsx`, `receivables/page.tsx`, and
  `relief-funds/page.tsx`, plus `components/wealth/*`, still use direct `fetch` and native
  selectors. Their current user flows have tests, but they do not satisfy the web component and data
  access rules. Refactor them as a separate web issue using the shared controls, query and mutation
  hooks, and focused interaction tests; do not change financial behavior during that refactor.
- The backend `CLAUDE.md` requires English source and documentation, service-based handlers, and
  tests. Document state transitions live in owner-scoped SQL functions. The current migration adds
  an audited rejection reason, audited restoration of a rejected draft, and reversible capture
  archiving. It never deletes a financial transaction or changes a balance.
- The mobile `CLAUDE.md` and `docs/DESIGN_SYSTEM.md` require an offline-first WatermelonDB flow and
  NativeWind controls. The mobile worktree had unrelated local changes during this audit. Mobile
  document review should follow the tested web contract after release, with local drafts and sync;
  no mobile source was changed here.
- `docs/usage/token-usage-agent-prompt.md` requires a failing test before behavior changes and the
  smallest capable model. The historical merchant suggestion is deterministic and bounded. A
  reviewer may request a separate category proposal through the existing metered OpenRouter text
  parser; this sends the edited merchant, amount, date, and a bounded source excerpt. Only a valid
  expense category is copied into the draft. The returned account, amount, and type are ignored, and
  the reviewer still confirms the transaction explicitly.

## Review behavior and remaining quality gates

1. Default an ambiguous `$` OCR amount to COP in the review draft. Preserve explicit USD evidence
   and the original OCR value; explicit USD still requires a future supported currency flow. A
   category suggestion may use similar, owner-scoped historical ledger merchants, but an account
   suggestion requires a unique visible four-digit card or bank account suffix plus institution
   evidence. “Bancolombia” alone never selects an account. The reviewer can override all selected
   rows with one account.
2. Fetch exact-amount/date candidates when a capture is opened. Show candidates with their source
   transaction link and evidence before approval. The existing server duplicate guard still stops
   duplicate creation; equal amount and date alone never cause an automatic rejection. For strong
   candidates, the reviewer may link the existing transaction in the individual review, or reject an
   observation with a recorded reason.
3. Rejection reasons are `already_recorded`, `duplicate_capture`, `not_a_transaction`, `unreadable`,
   `wrong_account`, and `other`. Restoration returns only an unlinked rejected observation to
   pending; a confirmed or linked observation remains immutable. Archived captures remain stored
   with observations and can be unarchived. Reuploading a replacement image is allowed.
4. Before release, run the complete web suite, typecheck, lint, and production build; run the
   backend SQL lifecycle tests and typecheck; apply the migration before deploying the web. Exercise
   one owner account and one wrong-owner request in staging. Verify visible candidate links, the
   Mercamas category proposal, ambiguous COP, multi-select account, reject/reopen, and
   archive/restore in the browser.

## Email intake: recommended sequence

**First usable release: sender-filtered forwarding into the existing reviewed notification inbox.**
Gmail can forward only messages matching a user-created filter after the destination address is
verified ([Gmail forwarding help](https://support.google.com/mail/answer/10957?hl=en)). A Cloudflare
Email Worker can receive and process routed mail
([Email Workers API](https://developers.cloudflare.com/email-service/api/route-emails/email-handler/)).
This can automate _new_ Lulo/Falabella notices without requesting broad Gmail OAuth access. It does
not backfill old mail; retain the existing local Apps Script export for historical messages. The
user must explicitly configure and verify a forwarding address. Evaluate the actual forwarded MIME
format, original Message-ID preservation, sender authentication headers, and duplicate SMS/email
messages using redacted fixtures before ingestion. An address per connected user plus an unguessable
route token can map ownership; do not trust the visible `From` header or an email body to select a
user. Intake saves pending evidence only and never calls the Bancolombia-only `/email` transaction
writer.

**Later, if one-click connection and historical sync justify the Google review work: Gmail OAuth.**
A web button would start Google's authorization-code flow with `state`, `access_type=offline`, a
narrow `gmail.readonly` scope, and an exact redirect URI
([web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server),
[OAuth best practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)).
The refresh token must be encrypted at rest and revocable; never expose it to the browser or a
model. `gmail.readonly` is a _restricted_ scope and storing or transmitting its data on a server can
require Google's verification and security assessment
([Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)). Validate that the
product's financial-mail use case and any transfer of message content to an AI provider meet
[Google Workspace's user-data policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)
before building this path. Do not assume a private test configuration is a durable public product
connection.

The sync pipeline would list only allowlisted bank senders and bounded date ranges; `messages.list`
returns IDs and `messages.get` retrieves each body
([Gmail list guide](https://developers.google.com/workspace/gmail/api/guides/list-messages)).
Persist a stable provider message ID and ingestion result per owner, not a whole mailbox. Use
incremental history IDs and a bounded full resync on stale history
([Gmail sync guide](https://developers.google.com/workspace/gmail/api/guides/sync)). Push
notifications require Cloud Pub/Sub and a renewed `watch` at least every seven days
([Gmail push guide](https://developers.google.com/workspace/gmail/api/guides/push)); begin with
scheduled polling if connection is approved, then add push only when volume merits it. Each email
becomes a reviewed inbox item, not an automatic financial transaction. Link duplicate notifications
to the same candidate transaction and keep bank event time distinct from email receipt time.

## Proposed follow-up web issues

1. **Document controller extraction:** split document list, match review, and batch posting into
   feature hooks and components below the project's size guideline; remove the redundant individual
   creation form after the batch flow covers its tests.
2. **Wealth UI standards:** replace direct fetch and native controls in loans, investments,
   receivables, and relief funds without changing business behavior.
3. **Email forwarding proof:** run a private synthetic Lulo/Falabella forwarding fixture, map
   authentication and Message-ID behavior, then add an owner-scoped intake path and reviewed inbox
   UI.
4. **Gmail OAuth decision:** confirm expected distribution and Google verification obligations, then
   estimate implementation and assessment costs before creating credentials or requesting Gmail
   scopes.
5. **Category quality evaluation:** compare history proposals and the opt-in AI proposals against
   reviewed labels, especially supermarket names such as Mercamas and unfamiliar QR merchants; use
   usage telemetry to decide whether automatic model calls are justified. Leave every result as a
   proposal until approved.
