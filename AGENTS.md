# Repository instructions for coding agents

Read `CLAUDE.md` before editing this repository, including its React Query, component size, and UI
rules. Read the relevant feature documentation under `docs/`, especially
`docs/plans/2026-10-01-document-review-audit-and-email-intake.md` for document review and email
intake.

If delegation is requested, use GPT agents only.

Write code, comments, documentation, and commit messages in English. User-facing text belongs in the
existing `messages/` locale files. Reuse `components/ui/` controls for selects, dates, buttons, and
checkboxes. Put API reads in `lib/api/queries/` with React Query and writes in `lib/api/mutations/`;
do not call raw `fetch` from components. Split large interaction flows into hooks and focused
components. Add a failing test before changing behavior, then run focused tests, typecheck, lint,
and the production build.

Do not create `middleware.ts`. Preserve owner-scoped review, duplicate checks, and explicit
financial confirmation. The web release precedes corresponding mobile work.
