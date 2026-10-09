# Bancolombia card repayment review

## Verified failure

On October 9, 2026, the production inbox analysis endpoint returned HTTP 503 for a card repayment
notice. Runtime logs did not preserve the upstream error reason, so a provider or quota diagnosis is
unavailable. The deterministic reader excluded the `bancolombia.com.co` sender domain and did not
recognize the source phrase `desde la cuenta`.

## Delivered behavior

- Accept the exact Bancolombia sender domains as parsing hints; authenticity remains unverified, and
  lookalike domains remain rejected.
- Read the explicit amount, date, time, source account suffix, and destination card suffix from the
  bank alert sentence.
- Return complete repayment evidence without requiring an AI request. Preserve `needs_review`
  because a repayment has no merchant and cannot satisfy the parsed-purchase database constraint.
- Propose a transfer only when distinct, active, owner-visible COP accounts uniquely match the
  source account and destination credit card. Leave unmatched destinations for review.
- Keep manual edits, explicit time confirmation, duplicate review, and human-confirmed financial
  posting.

## Validation

- Synthetic parser regression failed before the fix; synthetic parser, account matching, API, and
  form tests cover the corrected behavior without retaining private receipt content.
- Typecheck passed; ESLint reported zero errors and one existing React Hook Form compatibility
  warning. Prettier completed.
- A temporary-account browser check exercised the real analysis API at 1440px and 390px with no
  browser errors or horizontal overflow. The temporary account was deleted afterward.
- The initial unrestricted full test run encountered unrelated PDF worker and receivables timeouts
  under concurrent browser compilation. A controlled two-worker rerun verifies the release gate.

## Manual check

Reload the web inbox and analyze the original repayment again. Check the amount, original bank date
and time, source account, and destination card. A payment between registered owned accounts should
use Transfer and have no expense category. Confirm the original time before saving; reviewing the
form must not create a transaction.
