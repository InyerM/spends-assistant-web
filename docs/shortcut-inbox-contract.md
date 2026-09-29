# iOS Shortcut inbox contract

This is the first, review-only slice of
[web issue #3](https://github.com/InyerM/spends-assistant-web/issues/3). It requires backend
migration `20260929000030_shortcut_inbox.sql` before use. The endpoint stores the original text in a
private, owner-scoped inbox. Intake, status review, and export never create transactions or change
account balances.

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

## Explicit existing-transaction acknowledgement

After reading an inbox message and a candidate's evidence, a signed-in reviewer can choose **Review
this match**, then **Acknowledge existing transaction**. The browser sends
`POST /api/shortcut-inbox/{id}/match` with `{ "transaction_id": "<uuid>" }`. A Shortcut API key is
insufficient; this action requires the browser session. The database RPC resolves the owner from the
session, locks the pending inbox item, and verifies that the chosen transaction belongs to the same
user and is active. Candidate ranking never invokes this action automatically. The RPC only inserts
one immutable decision record and changes inbox status to `matched`; it does not modify a
transaction or balance. Repeating the same item and transaction returns the original decision ID. A
competing choice for the same item returns a conflict. Separately reviewed notifications may
reference the same transaction because one real event can generate multiple messages.

The response is `{ "decision_id": "<uuid>" }`. `GET /api/shortcut-inbox?status=matched` includes the
linked transaction ID and decision ID for each returned item. Decision rows are owner-readable and
append-only. The decision stores a transaction snapshot so the reviewed evidence is auditable. An
intentional hard delete of a transaction is an erasure exception: matching decision rows and their
snapshots are deleted, and surviving inbox items return to pending. Deleting an inbox item also
erases its decision. Ordinary soft deletion retains the historical decision.

## Reviewed new-transaction creation

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

On confirmation, one database transaction inserts the financial row, stores the original source,
receipt timestamp, external ID and raw text, updates the account balance and current monthly usage
counter once, appends an immutable decision snapshot, and marks the inbox item `created`. A retry
with identical reviewed fields returns the original transaction and decision IDs without changing
balances. A changed retry conflicts. The database applies the existing free-plan transaction quota
to this route; canceled Pro subscriptions do not bypass it. Its monthly counter uses UTC, matching
the existing web transaction route and Worker usage service. The atomic CSV import currently uses a
Bogota month boundary and needs a separate consistency fix before release.

Soft deletion of the linked transaction preserves the historical decision and retry result. An
intentional hard delete erases its decision snapshot and returns the surviving inbox item to pending
review. The transaction deletion path remains responsible for reversing its balance, as with other
transactions. The decision does not classify or create entries from messages automatically. No
remote migration, deployment, or production backfill was performed for this contract.
