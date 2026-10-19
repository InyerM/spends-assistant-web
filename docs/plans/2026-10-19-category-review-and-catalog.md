# Category review and multilingual catalog

## Delivered behavior

- History review displays the descriptions, notes and categories behind a suggestion. AI can explain
  the evidence and propose different wording and a category for an individual movement. The user
  explicitly chooses which proposals to apply.
- Selected rows may have different categories and purposes. Owner-scoped SQL checks original
  category, description and notes before changing metadata atomically. Amounts, dates, accounts and
  original bank evidence remain unchanged.
- Statement creation highlights description and category while AI analyzes them. Missing or
  ambiguous categories remain pending review rather than displaying a false success state.
- A positive credit-card entry named `ABONO SUCURSAL VIRTUAL` requires an origin decision. An
  own-account repayment is a transfer; a documented merchant refund can use Refunds. The label alone
  cannot establish the source of the money.
- A single 94-category catalog supplies Spanish, English and Portuguese defaults for signup and
  existing owners. Health and personal care have a dedicated group; bank interest and transfer
  labels are explicit. Existing IDs, personalized names, translations and hierarchy are preserved.
  Category editing can maintain names in all three languages.

## Release evidence

- Database migrations: backend `20261019000120_counterparty_review_context.sql` and
  `20261019000130_category_catalog.sql`.
- Audited production application on 2026-10-19: **0 existing transaction rows changed**, **0
  personalized category rows changed**, catalog size **94**. The audit compares full transaction
  snapshots and customized category snapshots in the same transaction as the migrations.
- Worker release: `a1aa9d42-4752-41ca-8b91-e8ba2b3fbf05`.
- Backend full suite: 129 files / 934 tests passed. Web full suite before the final dialog lifecycle
  regression: 249 files / 1,352 tests passed. Focused follow-up checks cover that regression,
  statement payment decisions, review API ownership and multilingual editing.
- Security checks cover consent, quotas, same-owner evidence, allowed category type, stale metadata,
  strict request fields and immutable financial evidence.

## Verification boundaries

- Browser QA uses a disposable owner, synthetic movements and the real deployed AI provider. No
  customer statement, password or source transaction is modified by QA.
- The original screenshot does not provide enough evidence to determine whether the USD 5 credit was
  a repayment or refund. No reliable historical provider trace was available to establish that
  specific earlier model response. The old unconditional success indicator and category-type
  filtering were reproduced and corrected.
- AI proposals remain editable suggestions. They cannot guarantee a purpose that is absent from the
  bank statement or reviewed history.
- Mobile implementation remains deferred until the web flow is complete.
