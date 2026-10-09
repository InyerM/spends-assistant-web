# Inbox action feedback and date order

## Design

Keep the current review view after transaction creation. Replace the pending state on that card with
a semantic green Created badge and a link to the saved transaction. Retain that card during
background refreshes until the user changes the view; do not switch the status filter or page
automatically. Financial posting remains explicitly confirmed and owner-scoped.

Use received date as the server-side sort before pagination, with newest first by default and oldest
first as an option. Add an ID tie breaker for stable pagination and reject unsupported sort values.

Replace the general action explanation disclosure with contextual help on the four primary review
actions. Tooltips work on hover and keyboard focus; adjacent information buttons open the same
explanation on touch devices. Keep the action labels visible.

Identify the claimed bank from the sender domain and explicit bank references using the existing
provider catalog. Show one bank only when evidence agrees. Unknown or conflicting evidence remains
unclassified. Identification is a parsing aid and must never authenticate a forwarded sender. The
sender review popover explains this distinction and links to the existing email sender settings. No
additional AI request or persistent trust designation is introduced.

## Validation and acceptance

- The date-order request and retained created-transaction link regressions failed before
  implementation.
- Verify both sort directions, stable received-date ordering before pagination, and invalid sort
  rejection.
- Create a reviewed transaction: the status filter, page, and search stay unchanged, and the same
  card links to the new transaction.
- Check green Created and Linked badges while preserving readable text labels.
- Open review help with keyboard and touch; check that it explains matching, analysis, informational
  messages, and dismissal without posting data.
- Check known sender domains, lookalike domains, unknown banks, and conflicting bank names. A
  detected bank never produces a verified-sender state.
- Run the repository typecheck, lint, format, test, and desktop/narrow-screen browser gates before
  release.

## Release checks

On October 9, 2026, the full suite passed: 191 files and 1,198 tests. Typecheck passed. ESLint
reported only the existing React Hook Form compiler warning after the lint issues in the changed
files were corrected. Formatting and diff checks passed. The temporary-account browser check
exercised date sorting, bank sender review, touch help, and analysis at 1440px and 390px with no
browser errors or horizontal overflow; the temporary account was deleted afterward.
