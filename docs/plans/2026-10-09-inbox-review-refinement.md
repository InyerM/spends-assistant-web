# Inbox review refinement

## Direction

Preserve Anotto's neutral dark surfaces, green completion states, amber review states, red dismissal
states, and the established assistant palette. Group search, review status, and reception date in
one responsive filter panel. Keep existing searchable selectors and the shared period selector.

Assistant field labels share a compact header with their status. Animated borders and rotating
progress icons belong only to analysis in progress. Completed suggestions use a static, subdued
purple outline and a check mark; manual edits remove the suggestion treatment.

Possible matches show readable descriptions and localized COP amounts. The existing
server-authoritative duplicate check runs before posting. Its review-required response opens a
blocking confirmation dialog with candidate evidence. Continuing submits the reviewed candidate
hash; cancellation retains the draft. Candidate overflow remains blocked.

Review badges retain text while color communicates pending, completed, informational, and dismissed
states. Document extraction, confirmation, rejection, and failure use the same semantic colors.

## Validation

- Regression test first failed because duplicate review had no alert dialog; it now passes and
  verifies explicit confirmation with the server candidate hash.
- All 189 web suites and 1,187 tests passed; TypeScript passed; lint reported zero errors and one
  existing React Hook Form compiler warning.
- Synthetic browser review at 1440 px and 390 px exercised filters, analysis, completed suggestions,
  and duplicate confirmation with no horizontal overflow or browser errors. Temporary account
  cleanup succeeded.
