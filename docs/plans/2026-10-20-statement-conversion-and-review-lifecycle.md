# Statement conversion and document review lifecycle

## Verified failures

- A real create request referenced a USD observation dated September 1 while its saved
  reconciliation scope was August 1–31. Creation correctly refused an out-of-period movement; the UI
  hid the specific reason.
- Enabling USD for an existing COP bank account failed against
  `accounts_owner_bank_account_suffix_idx`. The historical uniqueness constraint did not distinguish
  a physical root account from its linked currency ledger. Reproduction was rolled back and changed
  no balances.

## Intended behavior

- Preserve unique bank-account identifiers between physical accounts while allowing the same
  identifiers on their owned currency ledgers.
- Explain and block out-of-period creation before posting.
- Support a positive statement entry paid from an owned account in another supported currency, with
  explicit review of the amount debited from that funding account. Never pretend that a COP-only
  funding account holds USD.
- Fetch a dated USD/COP reference from the Superfinanciera dataset on Datos Abiertos. Display it as
  an estimate, not as the bank's actual debit or settlement rate. Require confirmation of the source
  amount before posting.
- Post and reconcile one atomic transfer with separate source and destination amounts, preserving
  the original statement evidence. Extend proof snapshots, comparison and deletion to honor the
  amount on each account's currency side; prevent generic financial edits from corrupting a
  converted transfer.
- Show a reconciliation icon and direct statement link alongside the transaction.
- Keep extraction status separate from a manual review status: in progress, completed, or no
  movements. Status changes organize documents without creating transactions or asserting that every
  row has been financially reconciled.

## Reference sources

- Public dated dataset: https://www.datos.gov.co/resource/32sa-8pi3.json
- Banco de la República explains that TRM is a reference and actual FX operations may use another
  rate: https://banrep.gov.co/es/banco/junta-directiva/conceptos/c22-98870q22-6375

## Gates

Focused failing tests precede every behavioral change. Cover account identity, ownership, stale
scope, both amounts and balances, valid proof, replay, rollback, duplicate detection, deletion and
unchanged customer records during migrations. Verify web flows with disposable owners before
shipping.

## Implemented and verified

- Bank identifier uniqueness applies to physical root accounts. Owned currency ledgers retain the
  same identifier and their separate currency balances.
- Statement creation blocks an observation outside the selected period and provides a specific
  error. No date is automatically broadened to force a match.
- Positive statement entries can be funded from another owned COP or USD account. The dated TRM is
  an optional, labeled estimate; the funding amount remains editable and requires explicit
  confirmation.
- One atomic transfer stores the source amount, original statement amount, destination amount,
  manually reviewed exchange rate and original evidence. Both balances, quota usage, idempotency and
  the reconciliation link commit or roll back together.
- The converted-transfer writer refuses potential duplicate funding or statement postings. A failed
  request does not create a second debit. Generic financial edits of these transfers are blocked;
  deletion reverses the correct amount in each currency.
- Proof snapshots preserve legacy JSON exactly and include conversion fields only for converted
  transfers. Comparison uses the amount and currency on the selected statement account side.
- Transaction rows show an accessible reconciliation icon linking to the actual source document. The
  document page reveals the linked document even when completed or archived.
- Documents have independent manual review labels: in review, completed and no movements. Changes
  are owner-scoped and audited; no-movements is refused for linked financial entries. Re-extraction
  reopens review. The sidebar, home widget and list share the updated pending semantics.

## Release evidence

- Migrations `20261020000050_currency_ledger_identifiers`,
  `20261020000060_statement_currency_transfers`, and `20261020000070_document_review_status` were
  applied with transaction snapshots and legacy-proof checks: zero existing transaction changes and
  zero existing proof-validity changes.
- Full backend suite: 137 files / 947 tests passed. Full web suite after the payment-picker
  regression correction: 267 files / 1,388 tests passed, plus four new focused support tests.
- Typecheck, lint and production builds passed; web lint retains the pre-existing React Hook Form
  compiler warning.
- Local browser QA used a disposable owner, synthetic statement evidence and the actual dated public
  reference. It verified the identifier fix, period explanation, editable estimate, both currency
  balances, valid proof, completed and no-movements filters, pending count and
  transaction-to-document navigation. Cleanup succeeded with no runtime errors.
- Mobile dialog bounds at 390×844 were y=42 through y=802, with no horizontal overflow. Desktop and
  mobile screenshots were inspected.
- Evidence artifacts: `/tmp/anotto-statement-conversion-browser-report.json`,
  `/tmp/anotto-statement-conversion-local-final.log`,
  `/tmp/anotto-statement-release-backend-full.log`,
  `/tmp/anotto-statement-release-web-full-green.log`,
  `/tmp/anotto-statement-release-build-final.log`, `/tmp/anotto-statement-conversion-migration.log`.

## Boundaries

- A reference FX rate does not establish the bank's actual settlement rate. Posting uses the
  reviewer-confirmed funding amount, with the rate recorded as manual review rather than
  bank-supplied evidence.
- The converted creation flow covers positive statement entries funded from another owned currency.
  Potential existing debits must be reviewed before another posting; they are not silently
  duplicated or reclassified.
- Workflow completion organizes captures and does not replace the per-movement reconciliation proof.
  Mobile native implementation remains deferred.
