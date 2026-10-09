---
version: 1
slug: 'route-categories'
primary_target: 'route:/categories'
related_targets:
  ['app/(dashboard)/categories/page.tsx', 'components/categories/category-form-dialog.tsx']
---

# Categories surface

## Scope and task

Route `/categories`; operate mode. The owner finds a localized category, understands its
parent/child relationship and visibility, and creates, edits, hides, or deliberately deletes
categories.

## Implemented composition

A centered `max-w-7xl` workspace uses `p-4 sm:p-6 lg:p-8` and `space-y-6`. A wrapping header places
a 30 px bold title and supporting subtitle opposite the primary new-category action. A neutral,
bordered, rounded filter panel contains shared search and the show-hidden switch; its controls stack
on narrow screens and share a row from `sm`.

Parent categories form a vertical sequence of bordered `rounded-2xl` panels without shadows. Parent
headers wrap names, status, and actions; a 44 px expansion control exposes child rows. Search
matches localized names or slugs, keeps matching children with their parent, and expands matching
groups automatically. Category forms use the existing dialog and shared controls. Deletion opens a
confirmation dialog with linked-transaction/child counts and typed name confirmation. Loading
skeletons, retryable errors, first-use creation, and filtered no-results/reset each have a specific
state.

## Constraints and memorable interaction

Inherit `DESIGN.md`; the hierarchy itself is the organizing visual device. The memorable interaction
is searching for a child and seeing its parent context remain visible. Preserve default-category
restrictions and explicit destructive confirmation. Reuse localized category names and existing
category-picker patterns. Store no personal category names or transaction counts in this brief.

## Evidence and review boundary

Sources: `app/(dashboard)/categories/page.tsx`, `components/categories/category-form-dialog.tsx`,
and `components/shared/search-input.tsx`. This brief records current structure and behavior;
independent rendered visual QA is tracked separately. No global token change is proposed.
