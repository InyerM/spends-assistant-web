# Workspace navigation, natural dashboard layout and short dictation

## Delivered behavior

- Primary navigation: Home, Transactions, AI Assistant, To review, optional Documents and Settings.
  Wealth groups accounts, investments, credits, receivables and relief funds. Categories and
  automation remain available through grouped Settings rows. Existing settings deep links retain
  their destinations.
- To review uses the existing owner-scoped queue without an email-only source restriction. Email
  verification remains a prerequisite for configuring email intake, not for reviewing existing
  shortcuts. Message classifications, reception dates, original sources and audited review actions
  remain available. The badge counts all pending sources through an authenticated, owner-filtered
  count-only endpoint.
- Documents appears when explicitly enabled in Settings or when document history exists. Setup
  explains receipt review and statement comparison; enabling it does not post transactions or change
  balances.
- Dashboard frames use natural content height, not fixed-height scrolling. ResizeObserver measures
  the inner content for grid row spans; chart height remains adjustable, while other cards grow with
  their content. Empty custom-chart containers are excluded.
- Five draft-only templates: Balanced, Spending control, Savings and goals, Daily activity and
  Detailed view. Optional modules are omitted when their required data is absent. Templates, moves
  and resizing are committed through the existing preference mutation only after Save; Cancel
  discards the draft.
- Dictation starts MediaRecorder before awaiting AudioWorklet initialization, preserving the first
  syllable. Prefix requests use complete PCM WAV snapshots; the final request uses the finalized
  recording container. The prompt accepts spoken item-plus-amount shorthand without requiring a
  payment verb. Successful dictation no longer displays a permanent explanatory paragraph or
  completion label; privacy/quota details are in the mic tooltip, and uncertainty prompts are brief.

## Validation and boundaries

Focused failing tests cover item-plus-amount transcription instructions, recorder start timing, grid
row spans, template selection and workspace activation. Count endpoint tests require the
authenticated owner and distinguish failures from an empty queue. Settings and inbox regression
tests reflect unified review and grouped rows.

Local Playwright used TEST_USER and TEST_PASS from private environment files. Real-account views
were read-only. A separate browser pass mocked only synthetic planning, budget and contact responses
to exercise populated cards without modifying financial records. All five template previews had no
intersecting widget rectangles or internal frame scroll; live width resizing, moving between
sections, Cancel, Settings rows, document setup, unified inbox and a 390px viewport passed. Private
screenshots and test-account exports remain outside the repository under /tmp.

Live Worker audio checks used synthetic Spanish speech: item/amount examples for potatoes, coffee
and taxi were financial; an unrelated weather sentence was unrelated. Four independent dictations
consumed four analysis units and the synthetic owner was deleted. This validates the fixtures, not
every accent, physical microphone or noisy environment.

- Backend: 120 test files, 919 tests passed; typecheck and source lint passed.
- Web: 231 test files, 1,311 tests passed; typecheck and production build passed. Full lint has one
  pre-existing React Hook Form compiler warning in the transaction form; changed-file lint has no
  errors.
- Worker release: 8a0c0df1-f80a-43f5-a908-198d24442806.

Navigation explorations remain localhost-only at http://localhost:4317 and excluded from deployment.
Native mobile modules and Apple integrations remain deferred until the web release is complete.

## Manual acceptance plan

1. Dictate a short item and amount, then pause; verify the final words and amount before Analyze.
   Check the microphone tooltip and the compact uncertain-speech prompt. Correct the text manually
   and confirm stale warnings disappear.
2. Open Settings; find Categories, Automation, Accounts and Budgets through rows. Open To review
   before configuring email and confirm shortcuts remain reviewable. Check the original source and
   pending count.
3. Open Edit home, preview each of the five templates, resize a chart, change a card width and move
   a widget to another section. Cancel once; then repeat and Save, reload and verify persistence.
4. Test cards with three budgets, multiple contacts and a short savings goal. Confirm no content is
   clipped, no inner frame scrollbar is needed and no widgets overlap at desktop and narrow web
   widths.
5. Activate Documents through its Settings setup and confirm it appears in primary navigation
   without creating a financial transaction.

A separate complete-container check recorded the short potatoes fixture with Chrome MediaRecorder at
128 kbps and submitted the finalized WebM to the live Worker. It returned the correct item and
10,000 amount with financial relevance. Browser recognition hypotheses and WAV prefixes remain
provisional; final audio evidence includes the beginning of the recording.

The full composer browser check passed after giving the microphone tooltip its own TooltipProvider:
native provisional words appeared before the AI response, silence stopped recording, the final short
Spanish amount was preserved, fallback WAV prefixes arrived during recording, the finalized WebM
shared the same quota session, and unrelated speech produced the compact prompt. Three dictations
consumed three units and the synthetic owner was deleted; both 1440px and 390px checks passed. The
component regression test renders DictationButton without an application-level provider so that
missing-context crashes remain detectable.
