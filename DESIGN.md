# Anotto visual system

Status: approved direction for the customer-facing web migration. Reference composition:
`docs/design/anotto/a-variants/preview.html?v=3&s=amber`. This document governs the production
implementation; the concept's figures and activity are fictional.

## Intent

Anotto is a calm financial workspace where users scan actual records and decide what to confirm. The
interface should feel precise, readable, and quiet. The three-bar mark and emerald identify the
product; amber gives supporting evidence and a second data series a distinct voice. The primary
action remains white so it is immediately findable on the dark canvas.

## Palette and semantic roles

| Role            | Value     | Use                                                               |
| --------------- | --------- | ----------------------------------------------------------------- |
| Canvas          | `#060708` | Page background.                                                  |
| Sidebar         | `#0B0C0E` | Navigation surface, separated by a quiet border.                  |
| Card            | `#111316` | Ordinary content surface.                                         |
| Raised surface  | `#161A1D` | Featured summary or nested elevation.                             |
| Control surface | `#22272A` | Hover, chips, inactive controls.                                  |
| Border          | `#30363A` | Card and control outlines.                                        |
| Divider         | `#2A3033` | Separation within a panel.                                        |
| Primary text    | `#FFFFFF` | Headings, values, essential labels.                               |
| Secondary text  | `#C3C9CA` | Supporting explanations.                                          |
| Tertiary text   | `#A6B0AF` | Metadata with readable contrast.                                  |
| Emerald         | `#64D59F` | Logo, active navigation, links, positive values, selected states. |
| Emerald hover   | `#44B985` | Interactive brand hover.                                          |
| Amber           | `#E8BE78` | Review context, supporting data, selected analytical series.      |
| White action    | `#F7FAF7` | A screen's primary action, with dark text.                        |

Use the HSL component variables in `app/globals.css` through Tailwind semantic utilities. The
existing `--primary`/`--primary-foreground` pair maps to the white action; `--brand` maps to
emerald; `--brand-secondary` maps to amber. `secondary`, `muted`, and `accent` remain neutral
surfaces. Do not replace semantic error, warning, transfer, or categorical chart colors with brand
colors. Financial gains and losses must include signs, labels, and accessible text instead of
relying on green or amber alone. Amber is an accent, not the warning status; warning uses a stronger
orange with an icon and explicit wording. Destructive actions remain red.

## Typography

- Manrope is the interface font. Use 400–800 weights and reserve 700–800 for primary headings and
  essential totals.
- Geist Mono remains available for technical values. Use tabular numerals for amounts and aligned
  figures; preserve localized number and currency formatting.
- Page titles: responsive 28–40 px, tight tracking, 1.1–1.2 line height. Section titles: 18–24 px.
  Body: 14–16 px with at least 1.45 line height. Metadata: at least 12 px where space allows.
- Do not use all-caps or letter spacing for paragraphs. Use small uppercase eyebrows only where they
  establish a meaningful section context.

## Geometry and density

- Use an 8 px base spacing rhythm, with 4 px for tightly coupled labels and 24–32 px for sections.
- Content should have a readable maximum width but not waste desktop space on transaction lists.
- Card corners are 16–20 px; nested panels and controls are about 10–12 px. Use a 1 px neutral
  border as the primary depth cue. Avoid decorative shadows and bright border stacks.
- The sidebar and mobile navigation preserve familiar destinations. Active navigation is an emerald
  text/tint treatment rather than a saturated fill.
- Primary actions are white with dark text. Secondary actions are neutral outline or ghost; amber is
  reserved for contextual emphasis, not a competing filled action.
- Model-assisted actions use a dark interior with a violet-to-blue-to-teal-to-amber gradient outline
  and white text. A soft glow appears on hover; the colors do not cycle continuously. The treatment
  includes receipt upload and extraction, AI parsing, AI rule generation, and AI category
  suggestions. Keep ordinary confirmation, posting, and destructive actions in their semantic
  styles; the outline signals an AI-assisted workflow rather than a financial state.

## Component behavior

- Reuse `components/ui/` for buttons, inputs, selects, dates, dialogs, tables, and toggles.
- Every interactive element needs visible hover, keyboard focus, disabled, loading, and error
  states. Maintain a 44 px touch target on mobile where the control is used by touch.
- Never make color the sole indicator of amount type, review state, or data-series identity.
- Keep document intake, extraction, review, and transaction posting visually distinct steps.
- List rows should support rapid scanning of merchant, account, category, date, amount, and status;
  long values should wrap or truncate without hiding the amount.
- Charts need legends/tooltips or equivalent labels and distinguishable series at small widths.
- Motion should confirm state changes, respect `prefers-reduced-motion`, and avoid decorative
  cycling color outside a clearly bounded assistant control.

## Responsive and accessibility checks

Inspect at 390, 768, 1024, and 1440 px. No unintended horizontal overflow, clipped primary actions,
or obscured focus targets. Body text and actionable labels should reach at least 4.5:1 contrast;
large text and meaningful icons at least 3:1. Verify keyboard navigation and screen reader labels on
forms, dialogs, charts, collapsed navigation, and transaction actions.

## Scope

This system applies to customer-facing web screens and localized customer copy. The mobile app
receives an adapted version after web release verification. Backend identifiers, stored evidence,
historical records, integration addresses, and financial behavior do not change as part of the
visual migration.
