# Document batch review

## Goal

Turn extracted image movements into user-reviewed transactions. An extraction is a draft: it never
changes a balance by itself. A user can select one or more pending observations, edit each movement,
approve them into transactions, or reject them. Rejected observations remain visible in a collapsed
section.

## Currency and learning

The vision prompt treats `$` as ambiguous. The backend clears a model-produced `USD` value when the
source excerpt does not explicitly identify dollars. The web app can suggest the currency shared by
active accounts, an explicit source currency, or a previous correction on the same document type. It
never posts a transaction based only on that suggestion: the user confirms the selected rows and
account. The current transaction API supports COP for this workflow.

Each correction stores the original OCR fields and an append-only edit entry. On later documents,
exact normalized merchant matches can suggest the account, type, and category from previously
confirmed transactions. A previously rejected merchant is flagged for review. These are local,
owner-scoped suggestions; no OCR history is sent to the model for training.

## Approval and recovery

The UI validates date, amount, description, currency, active account, and transfer destination.
Missing image time is recorded as `00:00` with `parsed_data.time_source = "unknown"`. Approvals run
sequentially and report per-row failures. Each transaction uses the existing duplicate check and
idempotency behavior. Before creating a transaction, the UI searches for an existing `web-document`
transaction with the same document and observation IDs, so a failed link can be retried without
another balance change. The database also blocks rejecting an observation with an unlinked created
transaction.

The transaction creation and document decision are still separate database operations. The recovery
lookup and database rejection guard limit the risk, but a server interruption between the two
operations can leave a transaction awaiting its link. A future atomic approval RPC can remove that
gap.

## Checks

- SQL tests cover owner-scoped correction, original OCR snapshot, review audit, edited matching, and
  orphan rejection.
- Web tests cover batch approval, rejection confirmation, collapsible rejected rows, correction
  retries, and recovery of a created transaction.
- The document route returns only owner-scoped records and embeds the already linked transaction
  fields used for suggestions.
