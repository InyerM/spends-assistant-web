---
version: 1
slug: 'route-notifications'
primary_target: 'route:/notifications'
related_targets: []
---

# Notifications surface

## Scope and task

Route `/notifications`; operate mode. The account owner scans received-email and budget notices,
filters unread items, marks one or all read, and opens the inbox or budgets for the underlying task.
Read state is separate from evidence review and financial approval.

## Implemented composition

A centered `max-w-3xl` column uses `p-4 md:p-6` and `space-y-6`. The title and outline mark-all
action share a wrapping header. All/unread buttons and an inbox link precede one bordered, rounded
list. Each row presents a kind icon, title, short excerpt, explicit read state, localized timestamp,
and a 44 px mark-read action. Unread titles have stronger weight; text communicates state alongside
color. Previous/next controls follow the list, with 20 records per page. Changing filters resets
page one; reading an item in unread mode also returns to page one. Loading, empty, load-error/retry,
and mark-read error states are rendered independently.

The sidebar/header bell opens a bounded, scrollable preview with mark-all and links to the full
notifications page, inbox, and budgets. Its badge shows total unread notices, capped visually at
99+. The full page supplies the continuing history beyond the preview.

## Constraints and memorable interaction

Inherit `DESIGN.md` and existing shared controls. The memorable distinction is a readable evidence
excerpt beside an independent read action. Marking a notice read never approves or posts its source.
Use localized labels and dates. Document structure with synthetic examples only; retain no private
notice text, addresses, or identifiers in this brief.

## Evidence and review boundary

Sources: `app/(dashboard)/notifications/page.tsx`, `components/notifications/notification-row.tsx`,
`components/notifications/notification-center.tsx`, and `lib/api/queries/notifications.queries.ts`.
This brief records implementation; independent rendered visual QA is tracked separately. No new
visual direction or global token decision is introduced.
