# Statement controls and category simplification

## Authorized corrections

- Card credits have one mutually exclusive origin choice. Choosing a payment after a refund updates
  the automatic description; manually written descriptions remain unchanged. A late AI response
  cannot overwrite the chosen payment description.
- An empty source-account selector is replaced by an explanation and the existing account-currency
  setup flow. The destination card's entire physical account group is excluded from funding
  candidates. Enabling a currency selects the new balance even if query refresh removes the setup
  control.
- The period label derives its mode from the actual controlled dates, including dates detected after
  initial render. A saved statement period can be compared again without deliberately changing its
  dates. Dates, accounts and financial posting still require explicit confirmation.
- Category labels are reviewed as language, not merely checked for three populated fields. Vehicle
  leasing, hobbies, food delivery, subscriptions, software, insurance and property labels are
  clearer in English, Spanish and Portuguese. Existing category IDs and financial assignments remain
  intact.
- Imported categories whose names and translations exactly match an old standard label receive
  corrected translations. Personalized wording remains protected. Missing translations on existing
  custom labels are filled separately, preserving every existing nonempty translation and the
  original category name.

## Accepted category organization

The owner selected Common categories plus More categories on 2026-10-19. The Categories workspace
now starts with categories referenced by transactions (including deleted history), budgets, common
expenses, planned expenses and automation actions, plus custom categories. New owners receive a
small starter selection. More categories exposes the remaining active catalog. Search always covers
both collections, and an unavailable usage summary shows the complete library. No category is
deactivated, deleted, merged or reassigned by this organization.

| Approach                                                 | Benefit                                                                     | Cost                                                          |
| -------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Common categories plus More categories (recommended)** | Keeps familiar categories easy to find and specialized categories available | Needs a visible way to show and manage the extended list      |
| Complete catalog with better search                      | Preserves the current organization                                          | Still presents a long list                                    |
| Reviewed category merges                                 | Removes genuine overlap                                                     | Requires per-owner destination review and reference migration |

The implemented organization keeps all categories with historical use available. Specialized choices
such as art and collectibles, checks and vouchers, or lottery winnings can live in the extended list
when unused. Vehicle leasing remains a distinct category when used. Naming changes do not require
moving transactions.

Possible additions after choosing the organization are **Tolls** under Transportation and
**Building/community fees** under Housing. Salary and freelance income could be separated for users
who need that distinction. Existing custom AI/software categories must remain separate from any
proposed general template.

Potential overlap such as Personal products versus Personal care needs a preview before merging.
Software, subscriptions and cloud services describe different purposes and should not be merged
solely because a merchant charges monthly. Lending and renting must be reviewed carefully: returned
loan principal and rental income have different meanings.

## Migration plan for a future merge

1. Count active and deleted transaction references, child categories, budgets, frequent expenses,
   planned expenses, automation rule actions and any JSON-stored category references. Transaction
   usage alone cannot establish that a category is unused.
2. Build owner-scoped source-to-destination proposals with matching posting types. Show affected
   movements and settings, including any conflicts, before confirmation.
3. In one audited transaction, preserve amounts, dates, accounts and original evidence; update only
   approved category references. Reject stale previews and record a reversible mapping.
4. Retire the old category only after checking every reference. Keep its ID for historical audit and
   rollback. Do not hard-delete a used category.
5. Apply the approved catalog version to future signups; preserve existing owners' names,
   translations and visibility choices.

The database reference audit found category references in transactions, monthly budgets, common
expenses, planned expenses and category parents. Automation actions also require application-level
inspection because JSON references are not represented by foreign keys.

## Verification

- Focused regressions reproduce empty account choices, refund-to-payment wording, late AI
  completion, refreshed currency selection, a previously saved comparison and asynchronous statement
  date ranges.
- SQL regressions preserve referenced transactions and custom translations while updating standard
  labels across catalog versions.
- Browser QA uses a disposable owner, a synthetic USD statement and the actual AI service. It
  compares a saved 17 August–15 September period, switches origin choices, enables USD on a separate
  account and selects that balance. It does not post a transaction or use a customer's PDF.

## Existing transaction AI review and duplicate evidence

- Editing an existing transaction can request an explicit AI review of description, category and
  notes, with pending indicators on those fields. Proposals have independent checkboxes and require
  an explicit action to copy them into the draft, followed by the existing Save action. Concurrent
  metadata edits and changed financial context are preserved. The analysis endpoint never posts a
  transaction or modifies an amount, date or bank message.
- Transfer wording is supported without recommending an expense or income category. AI consent,
  quota limits and owner-scoped historical evidence continue through the deployed review service.
- Pending duplicate warnings load their stored `duplicate_of` reference through the owned
  transaction API and show description, date, time, native amount and a link in another tab. Missing
  references are explained explicitly. No guessed replacement is presented as the stored duplicate.
- Keep both now uses a dedicated owner-scoped, terms-protected SQL decision with an append-only
  metadata audit. The original reference is retained. The former request used a field rejected by
  the transaction patch whitelist. Deletion continues through the existing audited transaction
  deletion path.

## Release evidence

- Backend commits: `dd7a923` (catalog and usage), `5a6be73` (review service and duplicate decision).
- Applied migrations: `20261020000010_category_catalog_labels`, `20261020000020_category_usage`,
  `20261020000030_duplicate_review`.
- Production migration audits: zero existing transaction changes, zero custom-name changes and zero
  overwritten custom translations. Four custom categories had missing language keys filled. No
  untranslated Spanish Leasing label remained. Private label repair inputs and audit exports remain
  outside the repository.
- Web source: `076dc9c`, deployed READY as `dpl_8ufXrW1Q38uNjdCk4PxfFvBdasZB` and aliased to
  [my.anotto.app](https://my.anotto.app).
- Worker version: `8a0b3f23-b7fe-44ac-b759-3f49a1e48980`. Follow-up backend commit `22ec1fb`
  supplies localized category names in both AI choices and history, so explanations use the screen's
  language.
- Local browser checks with the actual AI provider verified the exact duplicate reference, read-only
  existing analysis, preservation of a note edited while waiting, explicit metadata save and the
  audited Keep both decision.
- Production checks on 2026-10-19 verified both the saved-period/account-currency flow and the
  existing-transaction flow, including transfer wording, category collections and translated labels.
  Both browser reports had no runtime errors, passed at 390px without horizontal overflow and
  confirmed disposal of their synthetic owners. A final real-provider smoke verified Spanish
  category names in the AI explanation and removed its synthetic owner.
- Full suites: **939 backend tests across 133 files** and **1,371 web tests across 258 files**
  passed. The final localization adjustment passed its six focused AI/handler tests. TypeScript,
  lint and production builds passed; the existing React Hook Form compiler compatibility warning
  remains. The web suite used two workers and a 20-second test timeout after an unrelated
  receivables test exceeded its default five-second timeout during concurrent SQL/browser checks.
