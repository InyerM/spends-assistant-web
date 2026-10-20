# Expense metadata review and account transfer activity

## Accepted scope and design

The user requested AI review of descriptions and notes in addition to categories, and asked why the
USD card showed zero income despite a received payment.

The shared model already returned all three editable metadata fields. The bulk review UI and its
category-only writer discarded description and notes. The review now presents all three proposals,
lets the owner edit them and select each field independently, and applies only selected differences.
An owner-scoped SQL writer validates the expected original metadata and account before changing
anything and appends the before/after metadata audit. It cannot update financial fields or original
evidence. The existing category-only API remains compatible.

The account's USD payment is a transfer between owned accounts, so it does not increase income.
Activity now shows received and sent transfers separately, including card-specific Payments
received, and plots them alongside income and expenses. Incoming converted transfers use
destination_amount in the selected ledger's currency; outgoing transfers use the source debit.
Currencies are never added together.

Automatic application and relabeling card payments as earned income were rejected. Explicit owner
confirmation and separate transfer flows preserve the existing accounting meaning.

## Implementation and verification

- Migration 90: `review_expense_metadata`, strict selected-field allowlist, owner/terms checks, row
  lock, expected metadata guard and immutable metadata audit.
- Migration 91: account activity totals and monthly received/sent transfer series with account-side
  currency amounts.
- Focused tests first reproduced the missing metadata controls and transfer chart. SQL tests cover
  description/notes-only saves, rejected financial fields and stale/foreign access, and a COP 20,000
  → USD 5 receipt with separate USD income/expenses and both transfer directions.
- Backend full suite: 952 tests in 139 files passed (`/tmp/anotto-review-backend-full.log`).
- Web full suite: 1,402 tests in 274 files passed (`/tmp/anotto-review-fields-web-full.log`).
- Typecheck and lint passed; the pre-existing React Hook Form compiler warning remains
  (`/tmp/anotto-review-fields-types-final.log`, `/tmp/anotto-review-fields-lint-final.log`).
- Both migrations applied with zero changes to existing transactions or account rows
  (`/tmp/anotto-review-flow-migration.log`).
- Local Chrome verification passed real AI analysis, editable descriptions and notes, category
  opt-out, explicit selected-field saving, metadata audit, preserved financial facts/original
  evidence, mobile overflow checks, and a visible colored USD payment bar while income remained
  zero. Disposable owner deleted (`/tmp/anotto-metadata-flow-local.log`).
- UI screenshots were inspected locally: `/tmp/anotto-review-fields-desktop.png`,
  `/tmp/anotto-review-fields-mobile.png`.
- Production build passed (`/tmp/anotto-review-fields-build-final.log`). Backend migration/test
  commit: `301206a`.
