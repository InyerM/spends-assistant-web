# Dashboard, inbox and statement review follow-up

## Implemented behavior

- Dashboard drag targets show a dashed silhouette using the dragged widget's width and measured
  height before dropping. The source remains mounted during native drag. Move buttons and zone/size
  selectors remain available as alternatives. Adding a widget scrolls its canvas position into view,
  honoring reduced motion.
- Money alerts, pending documents and inbox review use a shared compact notification row. They show
  a count, one contextual line and a destination rather than the complete alert list.
- Inbox review, matching, reversal and financial submission disable competing actions in the same
  card and announce a saving indicator. A created transaction leaves a compact confirmation and a
  link to the transaction instead of repeating the entire message.
- Creating or categorizing a transaction can offer a review of other movements linked to the same
  confirmed contact identity. The reviewer selects individual rows; no historical category is
  presumed incorrect. The owner-scoped SQL command checks the current source category and each
  expected historical category under locks before changing category IDs. It does not alter amounts
  or balances. Results are bounded to 100 movements per review.
- Missing statement movements can be created through explicit review. The category, description and
  optional own-account transfer are reviewed before a confirmation checkbox enables posting. One
  owner-scoped SQL transaction creates the financial entry, adjusts the relevant balances and usage,
  saves statement provenance and confirms reconciliation. Incomplete evidence cannot be posted.
  Possible existing payments require further review rather than force creation.
- Statement creation is idempotent and retains immutable request evidence. Direct insertions cannot
  claim statement provenance without the dedicated command's authorization row. A missing statement
  time is marked unknown and hidden in the transaction list/detail instead of presenting midnight as
  a known event time.

## Why statement creation was previously unavailable

The earlier product decision restricted statements to reconciliation evidence and explicitly
prohibited financial posting. Both the UI and a database trigger enforced that decision. This
follow-up adds a narrow, explicitly confirmed posting command while retaining the existing
extraction and comparison boundaries.

## Validation

Focused failures preceded drag preview, inbox pending state, compact completion, statement posting
and contact-category commands. The web suite passed 238 files / 1,331 tests. The backend suite
passed 122 files / 921 tests with bounded workers. Initial unbounded backend execution exceeded
individual test timeouts under contention; bounded execution passed. Additional SQL checks cover
statement rollback on balance failure, transfer balance directions, immutable requests, repeat
safety and owner isolation. Both migrations were applied on 2026-10-19.

Browser checks and release evidence are recorded below after completion. Synthetic browser fixtures
are private and are deleted after each run; no personal financial data is used as a fixture.

Authenticated local browser verification passed compact notification rows, widget-add scrolling,
drag silhouettes, disabled pending inbox actions, compact created-message summaries, explicit
contact-category cleanup and statement creation with valid reconciliation evidence. No page errors
occurred; the synthetic owner and fixtures were deleted. Typecheck, lint and the production build
passed. The browser-host origin check also has a regression test rejecting a foreign origin.
