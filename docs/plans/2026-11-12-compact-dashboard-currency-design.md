# Compact dashboard currency control

## Approved direction

The owner rejected the separate large Home balance carousel and selected a single compact currency
control rather than repeated controls in each summary card. Remove the extra balance section. Put an
accessible previous/current/next control beside the Home heading, using the existing
selected-currency state. Do not reinterpret account balances as period income.

## Behavior and scope

- Previous/next buttons and keyboard navigation select only currencies present in active accounts.
  One currency is a static label; no accounts leaves setup to onboarding.
- The existing page state continues to drive the transaction query, income/expense/cash-flow cards,
  built-in category/nature/trend charts and recent transactions. There is no currency conversion.
  Explicitly configured custom charts retain their own currency; COP-only budgets retain their
  existing explanation for other currencies.
- No new query, provider call, posting or persisted preference is introduced. No automatic rotation
  or animation-dependent state is used.
- Reserve only a compact 44px-high control while loading. Preserve 44px touch targets, accessible
  names, current-currency announcements and visible keyboard focus.
- Account-detail balance paging is outside this Home change. Native Home follows the reviewed web
  release and preserves its single currency/setCurrency state; the previous physical artifact must
  not be installed as the new design.

## Validation

The initial regression failed against the large carousel: the compact group did not exist. Verify
one shared control changes all built-in currency consumers, navigation boundaries, a removed
currency, empty/single-currency states, compact responsive layout at 320/390/1440px, and absence of
the old extra balance card. Run focused tests, typecheck, lint, production build and the full
regression before publishing. Inspect native touch/safe-area behavior after applying the same
approved pattern.
