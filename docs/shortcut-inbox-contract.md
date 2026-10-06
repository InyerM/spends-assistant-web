# iOS Shortcut inbox contract

This implements capture and reviewed matching/creation for
[web issue #3](https://github.com/InyerM/spends-assistant-web/issues/3). It requires backend
migrations `20260929000030_shortcut_inbox.sql`, `20260929000080_shortcut_match_ack.sql`, and
`20260929000110_shortcut_create_transaction.sql`, and `20260929000120_shortcut_match_reversal.sql`
before use. The intake endpoint stores the original text in a private, owner-scoped inbox. Intake,
status review, and export never create transactions or change account balances; creation requires a
separate signed-in review action.

## Authentication and request

Create a per-user API key through the signed-in web settings/API-key flow. The plaintext key is
shown only at creation. Store it privately in the iOS Shortcut and send it as
`Authorization: Bearer sk_...` over HTTPS. The server hashes the token with the existing SHA-256
API-key scheme, resolves an active key, and derives the owner from that key. The request body must
not contain a user ID; if supplied, it is ignored. A browser session cookie also works for POST.
Listing, status review, and export require a browser session cookie; a Shortcut key alone cannot
read the inbox.

`POST https://<your-web-host>/api/shortcut-inbox`

Headers: `Authorization: Bearer <per-user-api-key>` and `Content-Type: application/json`.

```json
{
  "source": "sms-shortcut",
  "items": [
    {
      "external_id": "stable-message-id-001",
      "received_at": "2026-09-29T10:00:00.000-05:00",
      "raw_text": "Synthetic payment notification"
    },
    {
      "received_at": "2026-09-29T10:01:00.000-05:00",
      "raw_text": "Another synthetic notification"
    }
  ]
}
```

`source` is required once per batch: 2–40 lowercase letters, digits, hyphens, or underscores,
starting with a letter. Each batch has 1–25 items and a 128 KiB total body limit. Every item
requires the **original message receipt timestamp** in RFC 3339 with a timezone, a valid calendar
date in years 1900–2100, and nonempty `raw_text` of at most 4,096 characters. `external_id` is
optional or may be `null`; when present, it must be a stable nonempty string of at most 256
characters. Do not use the Shortcut run time as `received_at`; that would defeat replay detection
when `external_id` is missing.

Use a stable message ID whenever iOS exposes one. The server derives a SHA-256 idempotency key from
`source + external_id`, scoped by the authenticated user. Without an ID it uses
`source + normalized raw_text + received_at`; normalization applies Unicode NFKC, trims, collapses
whitespace, and case-folds. Two equal-value payments remain distinct when their message IDs or
receipt timestamps differ. Two otherwise identical messages with the same receipt timestamp cannot
be distinguished without separate external IDs and need manual attention.

## Per-item results and retries

The response never echoes message text or the API key:

```json
{
  "items": [
    { "index": 0, "status": "received", "id": "11111111-1111-4111-8111-111111111111" },
    { "index": 1, "status": "invalid", "error": "invalid_item" }
  ]
}
```

`received` means a new pending inbox row was saved. `previously_received` means the same owner and
event were already saved and returns the original inbox ID. `invalid` means that item was malformed;
valid neighbors can still be saved. `conflict` means an external ID was reused with different
content or receipt time, and the old row was left intact. `error` means storage failed for that item
and it may be retried. All-new batches return HTTP 201, all replays HTTP 200, and mixed or partial
outcomes HTTP 207. Invalid top-level JSON or batch shape returns 400, unauthorized returns 401, and
an oversized body returns 413. Always inspect every item result; retry `error` items with the same
original fields. Replaying successful items is safe.

An informational or non-transaction message is still saved as `pending`; intake does not use a model
to classify it. In the signed-in web app, open **Transactions → Shortcut inbox** at
`/transactions/shortcut-inbox`. Reviewers can mark a message as non-transaction, dismiss it, or
return it to pending. Original source, receipt time, message ID, text, and idempotency key are
immutable after insert. This slice stores only the current review status; a dated status-change
audit for ordinary status changes is deferred. `GET /api/shortcut-inbox/export` downloads all of
that user's rows, including raw text, as private JSON. Handle the downloaded file as financial data.

## Read-only candidate suggestions

The signed-in review page can request `GET /api/shortcut-inbox/{id}/candidates` for one owned inbox
item. The endpoint reads owned, active transactions and returns at most 10 suggestions with
evidence. An identical original message is marked a strong signal. A transaction with the same
amount, date, and uniquely resolved masked account suffix is marked a possible match. Multiple
same-value payments remain separate suggestions. Every database lookup is owner-scoped; the endpoint
never changes an inbox item or transaction. It never calls a model or makes a duplicate decision.

The parser only uses one explicitly stated currency amount after a supported payment verb, one
explicit calendar date, and one masked four-digit account suffix. It does not infer missing dates or
use a name-only account match. If an account suffix is missing, unknown, or ambiguous, the tuple
query is skipped. An exact original-message comparison is always attempted, including when parsing
fails. Empty results are inconclusive, and the response notes when the 10-result cap is reached.

### Lulo Gmail notice preview

The private Gmail export described in the backend `docs/guides/lulo-gmail-backfill.md` prepares
individual messages under the `lulo-email-backfill` source. It has not been run in the owner's
mailbox. The web app reads only the owner's existing inbox rows; it does not access Gmail. For this
source, a text-only preview recognizes the observed `Compra realizada` template, showing the Gmail
message timestamp separately from the bank event date and time, masked card suffix, merchant, and
the original amount text. The `$` symbol does not establish whether the amount was COP or USD. The
preview's confidence describes template completeness, not sender authenticity or settlement. It
retains short source excerpts so the reviewer can check each extracted field.

A zero-amount notice is labeled as a possible authorization and is never used for amount/date/card
candidate matching. A nonzero structured purchase may yield owner-scoped, bounded candidate
suggestions by amount, bank event date, and uniquely resolved card suffix. These are suggestions,
not duplicate decisions. Multiple event lines, malformed fields, other senders, and unsupported
payment templates remain in manual review. The Lulo preview does not offer the **Create new
transaction** action, and the signed-in web creation route rejects an owned Lulo inbox item before
calling its financial RPC. Acknowledging an existing match and nonfinancial inbox status changes
remain separate explicit review actions. No transaction, card balance, or loan balance is changed by
the preview or candidate lookup. Run the owner export and compare a small batch against Lulo card
statements before broad backfill or enabling any creation flow. The web route guard alone does not
block direct RPC calls; deploy the database-level Lulo source guard before a real Lulo import.

## Explicit existing-transaction acknowledgement

After reading an inbox message and a candidate's evidence, a signed-in reviewer can choose **Review
this match**, then **Acknowledge existing transaction**. The browser sends
`POST /api/shortcut-inbox/{id}/match` with `{ "transaction_id": "<uuid>" }`. A Shortcut API key is
insufficient; this action requires the browser session. The database RPC resolves the owner from the
session, locks the pending inbox item, and verifies that the chosen transaction belongs to the same
user and is active. Candidate ranking never invokes this action automatically. The RPC only inserts
one immutable decision record and changes inbox status to `matched`; it does not modify a
transaction or balance. Repeating the same item and transaction while its match is current returns
the original decision ID. A competing choice for the same item returns a conflict. Separately
reviewed notifications may reference the same transaction because one real event can generate
multiple messages.

The response is `{ "decision_id": "<uuid>" }`. `GET /api/shortcut-inbox?status=matched` includes the
linked transaction ID and decision ID for each returned item. Decision rows are owner-readable and
append-only. The decision stores a transaction snapshot so the reviewed evidence is auditable. An
intentional hard delete of a transaction is an erasure exception: matching decision rows and their
snapshots are deleted, and surviving inbox items return to pending only when that transaction was
their current decision. Deleting a transaction tied to a reversed historical decision does not
disturb a later match. Deleting an inbox item also erases its decisions. Ordinary soft deletion
retains the historical decision.

## Correcting an existing match

In the **Matched existing transaction** filter, a signed-in reviewer can choose **Review incorrect
match**, inspect the linked transaction ID, then choose **Undo match and review again**. The browser
sends `POST /api/shortcut-inbox/{id}/reverse` with `{ "decision_id": "<uuid>" }`. The owner-scoped
database function locks the inbox item, requires a current existing-transaction decision, appends
one immutable reversal record, and returns the original message to `pending`. It changes no
transaction, account balance, or usage counter. An identical retry returns the same reversal ID,
including after a later review. A stale retry of the old match cannot reinstate the same
transaction.

The original acknowledgement and its snapshot remain in the private audit history. After reversal,
the same inbox item cannot be linked to that same transaction again; this prevents a delayed retry
from silently reinstating a mistaken match. The reviewer can acknowledge a different existing
transaction or create a separately reviewed transaction. Deliberate reselection of the original
target would require a separate, versioned review flow. Only the current decision appears on the
inbox list. This action cannot reverse a `created` decision: correcting a financial row requires its
own transaction edit/deletion workflow. Local multi-connection PostgreSQL contention and remote
migration validation were completed before deployment on 2026-09-30.

## Reviewed new-transaction creation

For a structured forwarded Lulo purchase, the web form suggests the parsed merchant, amount, event
date and time, and a unique active COP Lulo credit card with the exact visible suffix. HTML entities
are decoded for both forwarded and historical previews. Exact Tiendas Ara and Mercamas merchant
aliases suggest the owner's active `groceries` expense category; other merchants still require
recurring category history or manual choice. A suggestion never confirms the event time or posts a
transaction by itself. Historical `lulo-email-backfill` items remain blocked from new transaction
creation.

For a Bancolombia forwarded notice, the form may suggest an account only when the sender domain
matches the observed bank notification domain and the body contains exactly one explicit
`T.Cred *1234` or `T.Deb *1234` reference. Credit evidence matches a unique owned active COP credit
card; debit evidence matches a unique owned active COP savings or checking account. Missing,
redacted, duplicate, and conflicting suffixes leave the account unset. This is a manual-review
suggestion, not sender authentication or automatic posting.

Migration `20260929000110_shortcut_create_transaction.sql` must follow the inbox and existing-match
migrations. The signed-in reviewer opens **Create new transaction** for one pending inbox item and
chooses an owned active account, an active category matching the chosen expense/income type, an
exact positive decimal amount, date, and description. The receipt date is suggested from the
original message timestamp in the `America/Bogota` timezone; the reviewer must verify it. No
category is inferred from ambiguous messages. Transfers are outside this form because they need a
destination account and a separate balance rule.

`POST /api/shortcut-inbox/{id}/create` takes the six reviewed fields as strings, including amount as
a decimal string. It requires a browser session; a Shortcut API key cannot make a financial
decision. The endpoint passes the payload to one owner-scoped SQL function. That function locks the
inbox item and account, verifies account/category ownership and status, and checks active
transactions with the same account/date/amount or identical original text. If any candidates exist,
it returns HTTP 409 with `status: review_required`, a hash of their sorted server snapshots, count,
and up to 20 candidate details; it writes nothing. More than 20 candidates returns
`status: review_overflow` with only 20 details and blocks this creation path until the reviewer
resolves the ambiguity manually. The reviewer can acknowledge a bounded result as a **distinct
payment**. The form then resends the same fields with `reviewed_candidate_hash` and
`confirm_distinct: true`. The SQL function recomputes the candidate set under locks; a changed set
requires another review. Equal amount/date/account is never treated as proof of duplication.

If the original purchase time differs from message receipt, the reviewer may enter an **Original
transaction time** and explicitly confirm it against the message or their records. This adds
`event_at` in RFC 3339 form with an explicit offset and `event_time_confirmed: true` to the reviewed
fields. The transaction date must match the event's `America/Bogota` calendar date, including when a
message arrives after midnight. The database rejects malformed, unconfirmed, or implausibly delayed
event times. `received_at` remains the immutable receipt instant; the reviewed event instant is
stored separately in the transaction and decision audit. Leaving the time blank preserves the
existing receipt-based behavior. Migration `20260929000180_shortcut_reviewed_event_time.sql` must be
applied before deploying the web form that sends these fields.

On confirmation, one database transaction inserts the financial row, stores the original source,
receipt timestamp, external ID and raw text, updates the account balance and current monthly usage
counter once, appends an immutable decision snapshot, and marks the inbox item `created`. A retry
with identical reviewed fields returns the original transaction and decision IDs without changing
balances. A changed retry conflicts. The database applies the existing free-plan transaction quota
to this route; canceled Pro subscriptions do not bypass it. Its monthly counter uses UTC, matching
the existing web transaction route, Worker usage service, and atomic CSV import migration.

Soft deletion of the linked transaction preserves the historical decision and retry result. An
intentional hard delete erases its decision snapshot and returns the surviving inbox item to pending
review. The transaction deletion path remains responsible for reversing its balance, as with other
transactions. The decision does not classify or create entries from messages automatically. The
database and web application were deployed on 2026-09-30. The reviewed 2026 backfill is in progress;
see the backend release manifest for verified counts and outstanding review.
