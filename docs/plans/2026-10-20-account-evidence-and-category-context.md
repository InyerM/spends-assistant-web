# Account evidence and category context

## Accepted scope

The owner requested shared rules, AI and history for category suggestions; a Shopping fallback for
marketplace purchases; full account-name tooltips; a valid unfiltered date picker; both transfer
legs in account activity; statement evidence in every transaction surface; and explicit correction
of an estimated COP funding debit while retaining the original reconciled USD credit.

## Design decisions

- Category review obtains bounded, related, categorized history from the authenticated owner's
  ledger. It excludes the transaction being reviewed and Uncategorized history. Matching category
  rules take priority; explicit current purpose takes priority over a merchant's usual purpose. AI
  explains proposals; the owner still confirms edits.
- A marketplace with no item detail may suggest Shopping. It cannot invent a narrower purpose.
  Unknown bank transfers still require context.
- Existing transaction review, category follow-up and statement suggestions share the category
  endpoint. Text intake and forwarded-email suggestions also receive owner history and automation
  context.
- Account filtering includes source and destination. Amount presentation projects the selected leg
  without mutating the canonical transaction. Transfers continue to contribute zero earned income
  and zero spending.
- Reconciliation links load in a batch per surface. Dashboard, account records, contacts and budget
  movements reuse the same evidence link as the transaction list. Detail and edit views retain
  evidence even if their provenance query fails.
- The funding correction is a dedicated owner-scoped SQL writer. It adjusts only the COP debit and
  derived rate, changes the COP balance by the difference, and preserves the USD credit. Immutable
  correction history and reversed/reissued statement links preserve auditability. An already
  reconciled source debit or possible duplicate blocks correction.
- Automatic conversion or silent customer data migration was rejected: the actual bank debit
  requires owner confirmation.

## Validation

Focused regressions reproduce the original NaN date label and missing destination filter. SQL tests
cover owner isolation, replay protection, stale amounts, balance failure rollback, immutable
financial fields, retained USD proof and deletion of the corrected transfer. Browser verification
and release results are recorded below when completed.

## Release validation — 2026-10-20

- Web full-suite snapshot: 1,397 tests across 272 files passed
  (`/tmp/anotto-account-web-full-green.log`); 41 focused tests include the subsequently added
  owner-cache and scalar-account filter regressions (`/tmp/anotto-account-web-new-tests-final.log`).
- Web typecheck, lint and production build passed
  (`/tmp/anotto-account-web-{types,lint,build}-release.log`).
- SQL migration 80 applied with zero existing transaction, account or reconciliation-link changes
  (`/tmp/anotto-funding-migration-release.log`).
- Local browser verification passed destination account records, destination list currency/date
  display, home statement evidence, explicit COP correction, unchanged USD credit and valid proof,
  document completion and source navigation. The disposable owner was deleted
  (`/tmp/anotto-account-browser-local2.log`).
- Real provider verification passed marketplace Shopping, owned history citations, category-rule
  priority and read-only suggestions; the disposable owner was deleted
  (`/tmp/anotto-context-ai-local2.log`).
- Worker version: `bb9649b9-db3c-45e3-90ed-c134ab26e072`
  (`/tmp/anotto-account-worker-deploy-final.log`).

## Production confirmation — 2026-10-20

- Backend commit `f7a10ca`; web runtime commit `b2a922d`.
- Vercel deployment `dpl_F1EbNNLQWAGpUZn3XcLymiPqCn4a` reached READY and is aliased to
  https://my.anotto.app (`/tmp/anotto-account-vercel-deploy.log`).
- Production browser checks passed destination account records, destination-filtered transaction
  list, valid all-dates label, home evidence link, correction of the actual COP debit while
  preserving the USD balance and proof, and source statement navigation. No browser runtime errors;
  disposable owner deleted (`/tmp/anotto-account-browser-production.log`).
- Production AI checks passed marketplace Shopping, relevant owned history citations, custom
  category-rule priority, read-only suggestions and the full account-name tooltip. Disposable owner
  deleted (`/tmp/anotto-context-ai-production.log`).
- Final backend suite passed 951 tests across 138 files
  (`/tmp/anotto-account-backend-full-final.log`).
- Evidence coverage includes full list, home, account records, contacts, budget movements,
  transaction detail and edit. Contact and budget evidence use the same batched query and link; the
  budget/account component tests verify the link is not nested inside another interactive element.

### Reviewing an estimated COP debit

Open the payment from the funding account or from the statement's **Only in Anotto** list. In the
transaction detail or edit dialog, choose **Review COP debit** (Spanish: **Revisar débito en COP**),
enter the actual bank debit and confirm it. The USD statement credit remains unchanged and
reconciled. Return to bank-statement comparison to reconcile the actual COP debit. If that debit is
already independently reconciled or exists as another transaction, review its existing link instead
of posting twice.
