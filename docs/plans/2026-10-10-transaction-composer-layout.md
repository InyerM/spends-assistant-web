# Transaction composer layout refinement

## Direction

The previous modal separated the usage counter from the input and gave analysis and manual entry two
equally dominant full-width buttons. The source actions also used different button treatments. Keep
the established Anotto theme while grouping the task into header, composer and action footer.

- Short introductory copy, with a left-aligned header on every viewport.
- Visible accessible input label and usage counter on the same row.
- Compact textarea with receipt and dictation controls in one integrated toolbar.
- Manual entry as a secondary text action; analysis as the primary right-aligned action.
- Responsive viewport margins and wrapping controls, including recorded-audio fallback errors.

This change adjusts presentation and locale copy only. Parsing, quota, consent, receipt intake,
duplicate review and financial confirmation remain existing flows.

## Validation

Browser checks at 1440px and 390px cover viewport containment, enabled analysis after entering text
and the manual-entry path. All synthetic owners are deleted after testing. Production release and
final gate results are recorded after publication.

Final validation passed: 221 test files / 1,294 tests, TypeScript, production build and ESLint with
no errors (one existing React Hook Form compiler warning). Computed browser widths were 500px at a
1440px viewport and 358px at a 390px viewport, preserving 16px narrow-screen margins. Analysis
became enabled after entering text, and manual entry still opened the existing form. No financial
records were created by these checks.

Production deployment `dpl_4r5fzKFDqWQiMpCXFq52xEkUbtLq` is ready at https://my.anotto.app.
Authenticated browser checks on that deployment confirmed both viewport widths, analysis enablement
and the manual-entry path. Synthetic test owners were deleted successfully.
