---
version: 1
slug: 'route-automation'
primary_target: 'route:/automation'
related_targets:
  ['app/(dashboard)/automation/page.tsx', 'components/automation/automation-form.tsx']
---

# Automation surface

## Scope and task

Route `/automation`; operate mode. The owner finds a rule, understands its conditions and actions,
and creates or edits an eligible rule. Account-managed detection rules explain their origin and
remain controlled through account identifiers.

## Implemented composition

A centered `max-w-7xl` workspace uses `p-4 sm:p-6 lg:p-8` and `space-y-6`. The wrapping header pairs
a 30 px bold title and subtitle with AI-assisted creation, conditional account-rule generation, and
the primary new-rule action. Actions keep readable labels and at least 44 px height. The bordered,
rounded filter panel stacks shared search above wrapping type/status selectors, then aligns them
from `lg`.

Rules occupy a vertical list of bordered `rounded-2xl`, shadow-free panels. Headers group name, rule
type, priority/status context, and eligible actions. Conditions and actions appear below a divider
in wrapping badges, moving from one to two columns at `sm`; long badge text wraps. Managed rules
carry an explanatory message and restricted controls. An infinite-scroll sentinel supplies loading,
manual load-more, and end-of-list feedback.

The existing rule form, AI proposal dialog, typed-name deletion confirmation, and account-generation
confirmation remain distinct flows. Initial loading uses skeletons; errors offer retry; filtered
empty results offer reset; a first-use empty state offers creation.

## Constraints and memorable interaction

Inherit `DESIGN.md`, including the existing AI-action outline. The memorable distinction is reading
conditions beside resulting actions before changing a rule. Rule management supplies review
proposals; it does not authorize automatic financial posting. Preserve managed-rule restrictions,
localized copy, shared searchable category pickers, and explicit confirmation. Do not copy real rule
conditions, account endings, or merchant names into documentation.

## Evidence and review boundary

Sources: `app/(dashboard)/automation/page.tsx`, `components/automation/automation-form.tsx`, and
`components/automation/ai-automation-dialog.tsx`. This brief records implementation; independent
rendered visual QA is tracked separately. No global visual-system rewrite is introduced.
