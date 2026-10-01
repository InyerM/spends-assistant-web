# Debit-card account correction review

The Transactions page links to `/transactions/account-corrections`. The page lists active
Bancolombia `T.Deb *9989` Shortcut purchases currently assigned to a credit-card account and offers
the owner's confirmed Bancolombia savings account ending in `2651` as the destination. The original
bank notice, current account, and candidate amount remain visible during review.

For each purchase, compare the notice with a bank statement posting. Enter the statement document,
page, exact posting line, and settled amount, then confirm that the posting was checked. Submitting
calls `POST /api/transactions/account-corrections`, which validates the request and invokes the
owner-scoped `correct_shortcut_matched_expense` RPC. That RPC checks the current account, amount,
active Shortcut match, and destination ownership; it moves the expense and account balances in one
transaction and writes an immutable correction record. A repeated request ID returns the original
result. Stale or conflicting data requires a fresh review.

Opening the page and inspecting a candidate make no ledger writes. A matching SMS alone is
insufficient to confirm a posted transaction or its settled amount. On September 30, 2026, the
production audit found 57 July–September candidates, and the available Q2 savings statement does not
cover them. Leave those candidates pending until the later quarterly statement is available.

The web route accepts corrections only through the authenticated user client. It returns private,
uncacheable responses and does not use a service-role client or directly update balances.

Relevant implementation: `app/api/transactions/account-corrections/route.ts`,
`app/(dashboard)/transactions/account-corrections/page.tsx`, and backend migration
`20260929000170_shortcut_financial_correction.sql`.
