# Document reconciliation confirmation design

## Current read-only slice

`GET /api/documents/[id]/suggestions` authenticates the caller and scopes the document,
observations, transactions, and accounts to that user. It searches active transactions with the same
amount, within three calendar days when the OCR date is a valid ISO date. An ambiguous or missing
date never becomes an exact-date match. Reference text and description overlap affect ordering
within a date tier, not eligibility. The response omits transaction `raw_text`, returns at most five
visible candidates per observation, and signals when the 100-row search cap could hide results.
Candidates are recomputed on request and are never persisted as decisions.

The current observation has no trusted account identifier. The transaction table has no dedicated
reference column. Account name is shown to help the user compare records, while reference matching
uses transaction text only on the server. These gaps prevent safe account or reference equality
claims. No external model receives transaction or OCR data.

## Schema required before confirmation

1. Add `match_transaction_id` to `document_observations`, nullable, with a same-user foreign key to
   `transactions`. Add the necessary `(id, user_id)` uniqueness on `transactions` for that composite
   foreign key. Keep `status` as the current observation decision (`pending`, `confirmed`,
   `rejected`). Do not reuse `transactions.is_reconciled`: its existing bank reconciliation meaning
   is separate.
2. Add an append-only `document_observation_decisions` table with `id`, `user_id`, `observation_id`,
   nullable `transaction_id`, `action` (`accept`, `reject_candidate`, `reject_observation`,
   `correct`), `before` and `after` JSONB snapshots, `idempotency_key`, and `created_at`. Give it
   owner RLS and unique `(user_id, idempotency_key)`. A candidate rejection records a decision about
   that pair; it leaves the observation pending so another candidate can be selected.
3. Add a transaction-scoped `decide_document_observation` RPC. It authenticates the caller, locks
   the observation and selected transaction, checks both owners and transaction `deleted_at`,
   validates the requested state transition, records the audit event, and updates only the
   observation state/link. `accept` requires exact amount and a date within the allowed window when
   the date parses; a user can first correct the observation with an audited `correct` action. Never
   insert or edit a transaction from this RPC. Repeating the same idempotency key returns the
   original decision; reusing it with different content fails.
4. Define the multiple-receipt policy before adding the unique link constraint. Recommended default:
   one confirmed observation per transaction, with an explicit review path for a second receipt
   instead of silently assigning both.

## UI and verification gate

The future review screen should show observation and transaction side by side, including date,
amount, account, type, description, the exact amount difference, and any existing confirmed link.
The user must click an explicit action and review a confirmation summary before `accept`,
`reject_candidate`, `reject_observation`, or `correct` calls the RPC. Show a returned decision ID
and a history timeline. Candidate badges must remain distinct from confirmed links.

Before enabling writes, test owner isolation, exact and ambiguous matches, false positives, missing
or ambiguous dates, multiple receipts, deleted transactions, correction followed by acceptance,
repeated idempotency keys, conflicting concurrent decisions, and rollback when the audit insert
fails. A UI test must prove that viewing suggestions makes no mutation request.
