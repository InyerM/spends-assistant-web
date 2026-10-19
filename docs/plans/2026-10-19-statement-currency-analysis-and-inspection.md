# Statement currencies, assisted categorization and reusable inspection

## Changes

- Opening a missing statement movement now requests a category and description proposal through the
  existing authenticated, metered financial-text parser. Automation rules can refine the proposal.
  The response cannot replace the statement's verified amount or date. Edits made while analysis is
  pending take precedence; consent and unavailable-service states leave manual review available.
- PDF extraction caches derived inspection metadata: card suffix, period, cycle, activity and
  supported currencies. It does not persist passwords or raw PDF pages. Owner-scoped inspection
  resolves current account identifiers from the cache before downloading or decrypting the original
  file. The bank's original PDF retains its existing protection.
- Reconciliation separates COP and USD, with an independent account and period for each currency.
  Existing legacy scopes and proofs remain compatible. Missing movements are visible before an
  account is selected; creation and reconciliation still require a matching-currency account and
  explicit confirmation.
- The statement parser now uses page-local currency context and recognizes Spanish dollar headers.
  Undated summary cells are excluded even when the model expands their descriptions. Period
  detection accepts PDF column headers between the period label and its date range.

## Private statement audit

The authorized four-page card statement contains two pesos pages and two dollar pages. Its billed
period is August 17 through September 15, 2026. The verified individual movements are two COP
movements and one USD credit for 5 USD. The previous extraction had assigned COP to eighteen
observations and left the dollar movement's currency unknown; sixteen of those observations were
already rejected summary cells.

The missing currency was corrected through the existing audited observation-revision command. The
sixteen rejections and existing review evidence were preserved. No financial transaction or account
balance was created or changed. Inspection metadata was cached from text decrypted with the
user-provided environment password; the password was never included in an AI request or retained in
the cache.

An authenticated read-only browser check of the actual statement verified the period, absence of a
repeated inspection password prompt and visibility of the 5 USD movement under USD. Private PDF
bytes, extracted pages, credentials and diagnostic reports remain outside version control and are
removed after verification.

## Reproducing contact category follow-up

Use an identified contact with an older uncategorized movement. Edit a different confirmed movement
of that same contact, assign its category and save. A short notification offers Review contact;
opening it lets the user select previous movements for the proposed category. The contact identity
must already link both movements; similar descriptions or four-digit beneficiary suffixes alone do
not identify a contact. No history changes automatically.

## Validation and release

Focused regression checks cover dollar grounding, expanded summary descriptions, independent
currency posting/proofs, metadata-only inspection, interrupted period headers, category proposals,
protection of reviewed amounts/dates and preservation of edits during AI analysis. Final suite
counts and deployment evidence are recorded after release.

## Production verification

Web commit `b4cee64` reached Vercel READY in deployment `dpl_9cNZGrRcwMvn1ZZimetgwRGCF67w` on
2026-10-19 and serves https://my.anotto.app.
[Deployment inspection](https://vercel.com/inyerms-projects/spends-assistant-web/9cNZGrRcwMvn1ZZimetgwRGCF67w).

An authenticated read-only production browser check of the authorized statement passed cached
inspection without another password prompt and visibility of its USD movement, with no page errors.
A production request analyzing the verified COP fee returned HTTP 200 with both a category and a
description proposal; the response contained neither an amount nor a date override. The retained
private diagnostic PDF, decoded pages, extraction output, metadata identifiers and access token were
removed after verification.
