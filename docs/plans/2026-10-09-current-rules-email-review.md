# Current automation rules and recipient history in email review

## Findings and behavior

The date-filter wrapper applied full width to every button inside the period selector, including
navigation arrows. Its selected-month state overflowed even though the empty state looked correct.
The filter controls now align to the same height; arrows retain their intrinsic size and period text
can truncate. Remove the empty refresh-status row from visual flow to avoid artificial spacing
between filters and results.

The owner's Liliana rule is active and matches the raw destination reference. Previously email
analysis required a provider result before applying the category, ignored the rule's note, and
labeled every completed proposal as AI. Analysis now applies the current active category rule first,
validates category ownership/type/activity, includes its note and readable rule name, and returns
explicit field provenance. A complete rule proposal can be returned without a provider request.
Pending cached suggestions re-evaluate current rules.

If no rule applies, examine at most 21 owner-scoped expenses from the same source account with the
exact destination reference. Require at least two records with one consistent category; refuse
proposals when results conflict, are insufficient, or hit the query cap. Validate the category
before suggesting readable historical description and notes. Distinguish these proposals from AI and
automation in field labels. Existing transaction confirmation remains required; analysis never posts
a financial movement.

## Validation

Regression tests cover deterministic recipient rule/category/note application without a provider
call, owner/account-scoped recipient history, insufficient/conflicting/prefix-mismatched history,
and existing cached-rule behavior. Browser review covers the selected-month state and automation
field provenance at 1440 px and 390 px, with no horizontal overflow or browser errors. Temporary
account cleanup succeeded.

All 190 web suites and 1,190 tests passed. TypeScript passed; changed-component lint passed. The
full lint scan retains the existing React Hook Form compiler warning.
