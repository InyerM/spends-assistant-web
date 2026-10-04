# Anotto product context

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user tracks personal finances across Colombian accounts and reviews transactions,
documents, investments, loans, and money owed by other people. The web application is the first
release surface; the companion mobile application follows a verified web release.

## Product Purpose

Anotto brings financial activity from manual entry, bank messages, imported records, forwarded
email, and document images into a reviewable personal ledger. The user must be able to understand
what was recorded, correct it, and trace supporting evidence.

## Operating Context

Users work with COP transactions, Colombian banks, screenshots, receipts, bank statements, Gmail
forwarding, and iOS Shortcuts. Investment and debt records have their own reviewed journals and may
link to existing bank transactions. Source material may be incomplete or ambiguous.

## Capabilities and Constraints

- A document extraction result is an observation, not an automatically posted transaction.
- Duplicate checks and explicit approval precede financial posting.
- Owner-scoped review and auditable state transitions remain the authority for document decisions.
- Internal repository, API, database, integration, and mobile bundle identifiers remain stable
  during the customer-facing rebrand.
- The existing receipt forwarding address remains valid during any public website domain change.
- Customer-facing copy supports English, Spanish, and Portuguese through the existing locale files.

## Brand Commitments

The customer-facing name is **Anotto**. The owner selected the three-bar wordmark, the typography
and layout of design direction A, the near-black **Void Emerald** variant, and **Amber** as the
secondary accent. The brand work is customer-facing; it does not rename internal services.

## Evidence on Hand

- Approved visual studies: `docs/design/anotto/a-variants/preview.html?v=3&s=amber` and its desktop
  and mobile screenshots under `docs/design/anotto/a-variants/previews/secondary/`.
- Release boundaries: `docs/plans/2026-10-03-anotto-customer-brand.md`.
- Existing app behavior and localized copy: `app/`, `components/`, `messages/`, and `tests/`.

## Product Principles

1. Preserve the user's financial data and approval controls through visual changes.
2. Show the source and review status of inferred financial activity.
3. Make account, amount, currency, date, and transaction type easy to scan.
4. Keep the web experience coherent before applying the identity to mobile.
