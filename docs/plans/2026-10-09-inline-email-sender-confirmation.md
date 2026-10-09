# Inline manual email sender confirmation

## Behavior

Each forwarded email exposes Verify sender in its sender row. The dialog starts with the detected
bank, supports another bank or a custom bank name, and records the user's explicit confirmation
without navigating away. Confirmed by you is green; Change bank reopens the dialog. The association
applies to the exact normalized email address for that owner and survives reloads.

Manual confirmation identifies the bank the user associates with the address. It does not
authenticate a forwarded email, change parsing or automation trust, create transactions, or modify
review state. The dialog states this distinction before confirmation.

## Data and access

Migration `20261009000037_email_sender_confirmations.sql` adds an owner-and-address primary key,
confirmation time, bank name, and originating inbox reference. Reads use RLS and an explicit owner
filter. Writes use `confirm_email_sender`, which derives the address from an owner-scoped forwarded
inbox item. Clients cannot supply a sender address or owner. The function rejects missing
authentication, foreign inboxes, malformed addresses, and invalid bank labels. Account deletion
cascades the associations.

The web shares an owner-keyed sender query across cards. A successful confirmation updates that
cache immediately, so every loaded email from the same address updates without reloading the inbox
or changing its filters. Confirmation failures keep the dialog open for retry.

## Acceptance checks

- Confirm a detected bank directly from an email; see the green manual confirmation and reload to
  verify persistence.
- Correct the associated bank through Change bank; other messages from that exact sender update.
- Choose Other bank and enter a name for an unknown provider.
- Cancel or fail a confirmation: no association is silently accepted and the inbox stays in place.
- Reject spoofed owner/address request fields, foreign inboxes, unauthenticated writes, and direct
  authenticated inserts.
- Preserve the pending email state and all financial data.

## Validation

The SQL, API, and inline dialog tests failed before implementation. The focused SQL tests exercise
owner isolation, restricted writes, normalization, correction, invalid labels, and missing
authentication in PostgreSQL through PGlite. API tests cover private caching and owner-scoped reads
and writes. The dialog test requires an explicit confirmation and checks the immediate in-place
update. Repository gates and a temporary-account browser check run before web release.

October 9 validation: 194 web test files and 1,207 tests passed, including the related analysis
resilience regressions. Web typecheck, lint (zero errors; one existing React Hook Form warning), and
full formatting checks passed. The sender SQL suite passed three tests. A temporary-account browser
check at 1440px and 390px confirmed the real RPC persisted the association across reloads, with no
browser errors or horizontal overflow; the temporary account was deleted afterward. Migration 37 was
applied to production before the web release.

Production browser validation on October 9 passed at both widths after deployment `95cab6c`: manual
confirmation persisted across reloads, no horizontal overflow or browser errors occurred, and the
temporary account was deleted. A subsequent email analysis integration check identified an existing
proxy mismatch: native clients send a bearer session token without browser cookies, but the analysis
path was not admitted to handler-level authentication. The follow-up proxy change allows only POST
to a UUID inbox analysis path with an Authorization header; the handler continues to verify the
token, accepted terms, verified forwarding, and inbox ownership. Other inbox writes, invalid paths,
GET requests, and missing headers keep browser authentication. The focused proxy, analysis, and
mobile-auth tests and typecheck/lint gates run before that follow-up release.

Additional source-evidence checks found that an incomplete Lulo notice lost valid amount and card
fields when its original time was absent. The analysis now uses each independently validated field
and repairs missing pending cached fields without another provider call. Account suggestions still
require a recognized sender template, positive purchase evidence, and exactly one active matching
COP credit card; unknown senders and ambiguous matches remain unassigned. No original timestamp is
invented when the notice lacks one. The focused parser, account matching, API, review UI, and proxy
suites passed 74 tests in five files.

The production bearer-session integration check on October 9 returned HTTP 201 with successful AI
usage, preserved synthetic amount, card suffix, original event instant, and matching owned account.
No financial transactions were posted, and the temporary account was deleted. A separate read-only
parser check confirmed that the original reported Hostinger notice has structured merchant, amount,
time, and card evidence. Its private contents were not exported into the repo.
