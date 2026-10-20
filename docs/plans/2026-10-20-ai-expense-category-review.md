# AI expense category review

## Decision

Extend the existing transaction category review entry point with an explicit AI review dialog.
Reusing only the transaction editor would hide uncategorized expenses without same-contact history.
Automatically processing and rewriting the whole ledger would obscure cost and approval. Use a
paginated, searchable queue and bounded selections instead.

## Scope

- Default to all historical uncategorized expenses; allow reviewing already categorized expenses
  too.
- Work without a contact record or a previously categorized transaction from the same merchant.
- Select up to five expenses per analysis, with two concurrent requests. Reuse the consent-gated,
  metered existing transaction review endpoint.
- Send the owned description, notes, original evidence, localized category catalog, and available
  same-contact history. Do not introduce a merchant allowlist or fixed platform-only classifier.
- Show current category, editable proposed category, and the AI explanation for each movement.
  Ambiguous merchants may receive no proposed category.
- Apply one explicitly reviewed category at a time. A dedicated owner-scoped SQL function locks and
  checks the original metadata and account/type, audits the category change, and never changes
  financial values or source evidence.
- Keep loading, partial failure, quota and consent states visible. Disable navigation while analysis
  or saving is active. No background AI requests or automatic saves.

## Validation

Add failing SQL tests for ownership, stale evidence, category type, audit and unchanged financial
values; API tests for queue scope and strict review inputs; hook and UI tests for selection limits,
real proposal explanations, and explicit save. Verify with a disposable owner and the real deployed
provider using subscription, restaurant, generic marketplace and ambiguous transfer examples. No
customer transactions are modified for QA.

Mobile remains deferred until the web flow is released.

## Release verification

- Backend source: `ff29af4`; migration `20261020000040_expense_category_review` applied with an
  in-transaction comparison confirming zero existing transaction changes.
- Worker version `5684a83f-3ec4-4537-b762-4fad891fe044` includes the bounded response recovery and
  merchant-context guidance.
- Full suites passed: backend 135 files / 945 tests; web 262 files / 1,378 tests, plus the new
  owner-cache-isolation test and eight final focused checks.
- Typecheck, lint and production build passed. Web lint retains the existing React Hook Form
  compiler compatibility warning.
- Local browser QA used a disposable owner and the real deployed provider. YouTube Premium and
  Spotify mapped to subscriptions, an explicit restaurant meal to restaurants, and an Uber trip to
  taxi. An unidentified transfer remained without a category and with unknown ownership.
- Analysis changed no transaction records. Explicit confirmation changed only the selected category,
  recorded one owner-visible audit entry, and preserved account balance, amount, date and original
  evidence.
- Both uncategorized and previously categorized expenses were searchable. The 390px dialog had no
  horizontal overflow and the browser reported no runtime errors. Disposable-owner cleanup
  succeeded.
- Evidence artifacts: `/tmp/anotto-expense-category-browser-report.json`,
  `/tmp/anotto-expense-category-web-full.log`, `/tmp/anotto-expense-category-backend-full.log`,
  `/tmp/anotto-expense-category-build.log`, `/tmp/anotto-expense-category-migration.log`.
