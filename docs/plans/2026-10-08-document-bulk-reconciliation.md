# Bulk document reconciliation

## Scope and review contract

The web document review offers a preview for existing ledger matches. It selects pending
observations with extraction confidence of at least 0.9, one complete candidate result, exact amount
and date, equal explicit observation and transaction currency, and supporting reference or
description text. Transfers, unknown currencies, truncated searches, competing observations, and
ambiguous candidates remain for individual review.

The reviewer opens the preview, follows the existing transaction links, and explicitly confirms the
batch. Each item uses the existing owner-scoped `decide_document_observation` endpoint and RPC. This
path creates no transactions and performs no balance writes. Decision keys survive retries during
the current mounted review session; failed rows remain available, successful rows are removed from
the local eligible set, and refresh failures are shown separately. Financial posting and review
controls are disabled while reconciliation is running.

## Currency authority and deployment

Apply backend migration `20261008000021_document_reconciliation_currency.sql` after the transaction
currency foundation and before releasing this web flow. The audited RPC rejects unknown or
mismatched explicit transaction currencies. Its transaction snapshot includes currency, type, and
account ID. Account currency does not substitute for transaction currency.

## Email statement intake gap

`spends/src/utils/email-mime.ts` currently discards parsed attachments: its return object retains
sender, subject, body text, message ID, and date. `spends/src/handlers/email-forwarding.ts` requires
body text. Consequently forwarded statement PDFs do not create document captures and cannot use this
reconciliation flow yet.

A separate intake change must retain bounded supported PDF attachments in owner-scoped document
storage with original message provenance, deduplicate them, and offer reviewed extraction. Choose
and approve PDF extraction and any password handling explicitly before transmitting statement
contents to an external processor. Existing image extraction is not proof of PDF support.

## Regression coverage

- Ranking and suggestions reject mismatched and unknown currencies, including USD transactions
  returned for COP accounts.
- Eligibility preserves ambiguous candidates and shared transaction matches for manual review.
- Hook and component tests require explicit confirmation, retain idempotency keys after transport
  failures, skip stale ineligible previews, and exercise links to existing transactions.
- SQL tests exercise currency rejection, retry idempotence, unchanged ledger rows, and audit
  snapshot fields.
