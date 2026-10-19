# Account currencies and category review

## Scope and decisions

- Keep each posting and balance in a single supported currency (COP or USD). Group currency ledgers
  under one visible account using `accounts.parent_account_id`; do not reinterpret historical money
  or manufacture an exchange rate.
- Enable a currency explicitly on an existing account from reconciliation or account detail. The new
  ledger starts at zero. Account names and recognition identifiers stay synchronized; group
  membership and compatible account types are guarded in SQL.
- Show statement movements before any account is selected. Currency sections have an explicit
  selected border and checkmark.
- Default unclassified expenses and income to owner-specific Uncategorized children under Others,
  preserving the transaction type. Internal transfers remain separate. Backfill only null categories
  on active expenses and income; preserve existing choices and all monetary fields.
- Keep category suggestions accessible in Transactions and contact detail. Use the latest
  categorized same-contact/same-type source, excluding Uncategorized as a recommendation. Permanent
  review lists unclassified history. After creation or editing, offer differing same-contact history
  for explicit review. Select nothing automatically; reject stale selections atomically.
- Show account activity over six calendar months, top expense categories, recent movements and
  native balances. Daily transaction totals and recent activity retain their currency.

## Implementation

Backend migrations:

- `20261019000030_account_currency_ledgers.sql`: owner-authorized idempotent enablement, separate
  balances and immutable groups.
- `20261019000040_default_uncategorized.sql`: database defaults and category-only backfill.
- `20261019000050_category_suggestion_queue.sql`: persistent owner-scoped suggestions and
  placeholder exclusions.
- `20261019000060_uncategorized_correction_compatibility.sql`: keep audited incoming corrections
  compatible with the new placeholder.
- `20261019000070_account_activity.sql`: complete ledger aggregation for a bounded period, without
  cross-currency sums.
- `20261019000080_manual_currency_posting.sql`: manual, document and scheduled posting use the
  reviewed account currency; supplied mismatches fail.
- `20261019000110_account_incoming_activity.sql`: include incoming internal transfers in movement
  counts while keeping them out of income/expense totals.
- `20261019000100_currency_safe_account_detection.sql`: legacy alias detection only manages COP
  ledgers; USD account selection is explicitly reviewed, and manual USD drafts skip alias-only
  account overrides.
- `20261019000090_account_currency_group_metadata.sql`: group invariants, synchronized recognition
  metadata and refreshed locked source data.

Web surfaces: Accounts list/detail, statement account setup and currency sections, Transactions
category review, contact detail, transaction creation/editing, native-currency daily totals and
recent dashboard movements.

## Verification, 2026-10-19

- Backend suite: 125 files, 927 tests passed; the final group-metadata extension also passed its
  focused SQL test.
- Web suite: 245 files, 1,343 tests passed; focused additional owner-read route tests cover account
  activity and contact-scoped suggestions.
- TypeScript checks and lint passed, with the pre-existing React Hook Form compiler warning in
  `transaction-form.tsx`.
- Production build passed.
- Disposable-owner browser flow on localhost: default category, edit then permanent category review,
  explicit history update, visible unconfigured USD movements, enable USD on the existing account,
  compare statement, post USD, one grouped account, desktop and 390px web viewports, zero page
  errors. The synthetic owner was deleted afterward.
- Production database verification after backfill: zero active expenses/income with a null category.
  Nine migrations applied. No credentials, PDFs or private exports are included.

## Release

- Backend commits: `763ee87` and `9ad3578`; web application commit: `131b581`.
- Production deployment: `dpl_C6VspjaWzZSW8raEW84gwgmhbvR2`, READY, aliased to https://my.anotto.app
  on 2026-10-19.
- Production browser smoke passed the disposable-owner flow above at desktop and 390px widths, with
  zero page errors and confirmed cleanup.
- Final focused SQL regression: 6 files / 26 tests; incoming activity extension: 1 test. Final
  focused web regression: 4 files / 62 tests plus 2 owner-read route tests.

Native mobile implementation and exchange-rate conversion are outside this release.
