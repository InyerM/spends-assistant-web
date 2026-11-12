# Anotto existing-module UX audit — 11 November 2026

## Scope and evidence limits

This is a source-backed audit of existing Next.js web and Expo/React Native mobile modules. It is
not a completed authenticated product usability audit. No Arq screenshot was supplied to this
worker; the reference is treated as the requested currency-card interaction direction, not a
reproduced interface. The local standalone prototype uses fabricated balances and no API,
credentials, analytics, or financial mutations. Source paths below are relative to sibling
`spends-assistant-web` (W) or `spends-assistant-mobile` (M).

Prototype: `http://127.0.0.1:4187`, `/tmp/anotto-ux-review-2026-11-11/index.html`. Server explicitly
binds 127.0.0.1; no public application route or deployment artifact was added. Baseline panel is a
schematic reconstruction of account-detail currency chips, not a product screenshot. Mobile home
currently uses a picker sheet, so the baseline must not be described as an exact home comparison.

## Evidence-based module matrix

| Module                | Verified existing behavior and evidence                                                                                                                                                                                                                                                                                                                                                                                        | Priority / proposal                                                                                                                                                                                                  | Acceptance evidence needed                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation            | W sidebar provides named primary navigation, current-page and expansion semantics (`components/layout/sidebar.tsx:146`, `:189`, `:202`). M uses five tabs with distinct iOS NativeTabs and Android Tabs (`app/(tabs)/_layout.tsx:18`, `:48`; `src/lib/constants/tab-navigation.ts:11`).                                                                                                                                        | P2: keep five destinations; test reachability of accounts, settings, documents and nested back fallbacks rather than expand tabs.                                                                                    | Authenticated keyboard traversal; VoiceOver/TalkBack, deep links and device back navigation.                                          |
| Accounts / currencies | W detail groups ledger currency chips and separately labels selected balance (`app/(dashboard)/accounts/[id]/page.tsx:82`, `:114`). M shared CurrencySelector has radio state, check icon, font scaling and 48px minimum height (`src/components/shared/CurrencySelector.tsx:21`, `:26`, `:37`). M home uses a currency picker sheet with focus-aware closing (`src/components/dashboard/HomeFilterBar.tsx:24`, `:36`, `:60`). | P2 exploration: cards can expose both balances immediately. Keep compact selectors in forms/reconciliation. Scope selected card to its labeled account/activity; always print ISO code; never add unlike currencies. | Large balances, USD/COP ambiguity, one currency, three-plus currencies, disabled/empty ledger; user chooses visual direction locally. |
| Dashboard             | W summary explicitly formats COP (`components/dashboard/summary-cards.tsx:89`, `:120`); M home passes selected currency into dashboard data (`app/(tabs)/index.tsx:36`, `:39`).                                                                                                                                                                                                                                                | P1 validation: ensure users can distinguish COP report totals from account-native balances and selected-currency views. This is a clarity risk, not a demonstrated calculation bug.                                  | Real multi-currency fixture and cross-check of labels, source totals and report scope.                                                |
| Transactions          | W list reads loading/data but omits query error, then renders noTransactions for no date groups (`components/transactions/transaction-list.tsx:329`, `:397` before fix). Per-day totals already show ISO code (`:417`–`:421`).                                                                                                                                                                                                 | P1 confirmed defect: initial request failure appears as empty ledger. Add localized alert + retry, preserve successful empty state.                                                                                  | Focused failing regression before fix; verify retry and successful empty behavior. Root authorized scoped correction.                 |
| Inbox                 | W inbox is a workspace entry point. M inbox has refresh/review error strings and selectable status filters with radio state (`app/email-inbox/index.tsx:118`, `:138`, `:246`), plus empty presentation (`:272`).                                                                                                                                                                                                               | P1 validation: distinguish intake, analysis, review and posting; preserve explicit posting confirmation and duplicate evidence. Add recoverable retry context where product tests reveal a gap.                      | Authentic pending/duplicate/rejected/analysis-failed fixtures; verify no posting by merely opening or analyzing.                      |
| Documents             | W capture has invalid-file, extraction-specific, consent and empty-state treatment (`app/(dashboard)/documents/page.tsx:98`, `:123`, `:265`, `:279`). M has refresh failure and empty guidance (`app/documents/index.tsx:44`, `:173`).                                                                                                                                                                                         | P1 validation: preserve readable source preview while reviewing fields; ensure upload/extraction/review/posting state labels remain distinct and error recovery retains user work.                                   | Password-protected PDF, invalid image, extraction failure, consent denial, narrow screen with keyboard.                               |
| Reconciliation        | W separates currencies, filters observations and proofs, and keys the review panel to selected currency (`components/documents/statement-currency-review.tsx:19`, `:34`, `:43`, `:57`, `:79`). Explicit retry already exists in wrapper (`components/documents/statement-reconciliation.tsx:18`).                                                                                                                              | P1: retain scoped review controls; do not replace every currency control with a decorative carousel. Validate changing currency does not hide unsaved edits or imply cross-currency balance.                         | COP/USD statement, missing currency, unresolved observations, proof links and save/restore review outcomes.                           |
| Settings              | W hub has labeled group sections and navigable rows (`components/settings/settings-hub.tsx:11`, `:17`). M consent disables switches during loading/saving and offers retry (`app/settings/ai-consent.tsx:80`, `:94`).                                                                                                                                                                                                          | P2: verify findability of capture configuration, permissions and security; preserve clear consent state, loading and recovery.                                                                                       | Screen-reader labels and settings return paths; offline consent does not appear granted.                                              |
| AI                    | W chat differentiates quota/scope/generic errors, has a polite response region and source links (`app/(dashboard)/chat/page.tsx:80`, `:93`, `:110`).                                                                                                                                                                                                                                                                           | P1 validation: show period/source scope next to response and distinguish suggestions from committed changes. Preserve citations and required consent.                                                                | Quota, out-of-scope query, streaming interruption, no sources and denied-consent fixtures.                                            |

## Visual alternatives and recommended default

A. Keep existing currency controls: lowest implementation cost, compact and familiar; hides
unselected balances. Appropriate for a form or reconciliation scope.

B. Currency balance cards (recommended for account overview exploration): ISO code, full native
balance, explicit selected check, readable next-card peek, previous/next buttons, horizontal
swipe/scroll and activity tied to selected card. No automatic rotation. Selection requires
tap/click; horizontal browsing alone must not silently change financial scope. Selected state must
be exposed independently of color. The prototype implements toggles, buttons, live announcement,
visible keyboard focus and reduced-motion respect. It is a visual proposal, not production-ready
native code.

C. Static side-by-side currency summary: best discoverability with two currencies and enough web
width, but poor fit for many currencies or large text. Consider as desktop presentation of the same
semantic model rather than a separate global navigation mode.

The prototype demonstrates readiness, empty, loading, error and offline copy using a local state
switcher. These are demonstrative text states, not functional retry/create flows. Error retry and
financial posting must be verified in the real product.

## Mobile and compatibility guardrails

M safe areas already have a dedicated ScreenFrame (`src/components/layout/ScreenFrame.tsx:15`);
ScreenContent intentionally adds no extra padding (`src/components/layout/ScreenContent.tsx:4`). Do
not diagnose missing safe areas solely because an individual screen uses a plain View. Test actual
device scene geometry before modifying these wrappers.

Native acceptance matrix: iPhone with home indicator at large Dynamic Type, small iPhone, iPad
portrait/landscape, Android gesture and three-button navigation; VoiceOver and TalkBack;
offline/cached screen; reduced motion; keyboard entry; conflicting horizontal card gesture versus
vertical scrolling. Browser acceptance matrix: Chromium, Firefox, Safari/WebKit; 320/390/768/1440
widths; 200% zoom and keyboard-only navigation. No native or cross-browser product pass is claimed
here.

## Rollout sequence

1. Correct confirmed query failure/empty-state defect with regression evidence, then root code
   review.
2. Obtain local visual choice for account currency cards; retain controls elsewhere by default.
3. Web implementation only after concrete proposal review; reuse UI controls, locale messages and
   React Query contracts.
4. Verify multi-currency and accessibility fixtures, relevant tests/typecheck/lint/build,
   independent review.
5. Mobile parity follows released and reviewed web contract; measure actual device safe
   areas/gestures before changes.

## Explicitly not completed

Populated transaction/document/reconciliation flows; actual Arq comparison; Safari/Firefox
rendering; native simulator/device interaction; screen-reader testing; financial correctness
certification. These require real fixtures and platform sessions, and must not be reported as
completed.

## Executed prototype verification

Headless Chromium rendered the standalone page at 1440×1000, 390×844 and 320×800. Automated checks
found no document-level horizontal overflow at those widths; desktop and mobile button selection
changed activity to USD, and the error demonstration changed its live text. Screenshots:
`desktop.png`, `mobile.png`, `narrow.png`; desktop and mobile screenshots were visually inspected.
This validates only the prototype, not the real web/native product. The first mobile render exposed
document overflow, fixed by setting grid panels to `min-width:0` and the phone preview to
`width:100%`; the screenshots and rerun reflect the corrected version.

## Scoped source correction authorized by root

The initial-load transaction error branch is now proposed in W
`components/transactions/transaction-list.tsx:405`, with locale messages at `messages/en.json:470`
and `messages/es.json:470`. Regression file
`tests/components/transactions/transaction-list-error.test.tsx` first reproduced two failures with
one successful-empty control passing (`test-red.log`), then passed all three cases after correction
(`test-green.log`). It verifies error versus empty, retry dispatch and disabled retry while
fetching. No source changes were made for the currency-card proposal. Cached-data/pagination failure
presentation is outside this scoped correction.

TypeScript `--noEmit` passed. Scoped ESLint passed. Prettier check passed for the changed component,
test and locale files. `git diff --check` passed. Full web suite and production build were started;
their final results are recorded separately in `test-full.log` and `build.log` and must be checked
before a release claim. The full suite initially reported failures in unchanged receivables and
loans tests while multiple repository suites and the build competed for CPU; this is not yet proof
of a baseline defect or a passing release gate.

Additional Chromium prototype checks: focusing the USD card and pressing Enter changed activity to
USD; exactly one desktop card exposed `aria-pressed=true`; emulated `prefers-reduced-motion: reduce`
yielded card transition duration `0s`.

## Final validation status

Production build exited 0, confirmed from command session 6128 on 11 November 2026; `build.log`
includes successful compilation and completed route output. Full-suite command completed with 13
failed files / 268 passed files and 30 failed tests / 1489 passed tests in 295.66s. This was an
uncontrolled concurrent run; it is not a passing release gate. No full-suite rerun was started after
root requested a controlled backend run.

Failing web test files queued for a later controlled rerun (counts from `test-full.log`):

| File                                                               | Failed tests |
| ------------------------------------------------------------------ | -----------: |
| `tests/app/receivables/page.test.tsx`                              |            2 |
| `tests/app/investments/page.test.tsx`                              |            4 |
| `tests/app/loans/page.test.tsx`                                    |            5 |
| `tests/app/relief-funds/page.test.tsx`                             |            1 |
| `tests/components/transactions/shortcut-create-form.test.tsx`      |            1 |
| `tests/components/budgets/budget-editor-dialog.test.tsx`           |            1 |
| `tests/app/documents/page.test.tsx`                                |            1 |
| `tests/app/categories/page.test.tsx`                               |            1 |
| `tests/components/layout/sidebar.test.tsx`                         |            1 |
| `tests/components/documents/statement-payment-resolution.test.tsx` |            1 |
| `tests/app/shortcut-inbox/page.test.tsx`                           |            5 |
| `tests/app/documents/bulk-review.test.tsx`                         |            4 |
| `tests/store/ui-store.test.ts`                                     |            3 |

The three UI-store failures explicitly report unavailable storage (`setItem` on undefined),
alongside Node 26 warnings that localStorage requires a configured file. Other failures must be
triaged from their actual assertions/timeouts; concurrency alone does not prove their cause.
Preserve separation between environment problems and product regressions.

## Dark-theme visual follow-up

The local prototype defaults to an Anotto dark preview and provides a light comparison toggle. Dark
colors are copied from existing W `app/globals.css:8` (background), `:10` (card), `:20` (muted
foreground), `:25` (border) and `:28` (emerald brand). This is an existing-brand exploration, not a
new product theme implementation. Prototype remains outside all public routes and deployment
artifacts.

Dark preview verification: Chromium rerender at 1440×1000, 390×844 and 320×800 produced no document
overflow. The 390px dark screenshot was visually inspected. Light-theme toggle changed the document
theme successfully. Evidence files: `/tmp/anotto-ux-review-2026-11-11/desktop-dark.png`,
`mobile-dark.png`, `narrow-dark.png`. Full-suite exit status was confirmed as 1 from command session
42396; build exit status was confirmed as 0.

## Authenticated read-only walkthrough attempt

Initial attempts against port 3000 did not validate Anotto. Follow-up inspection established that
this port belonged to a different local application: the masked public login screenshot showed Renta
Copilot and the listener process working directory belonged to that repository. Therefore the
missing token response and unchanged login route are not evidence of an Anotto authentication defect
or incorrect test credentials. That server was left untouched. A short-lived Anotto development
server on port 3002 was stopped, and the completed production build was started with Node 22 at
`http://127.0.0.1:3107`, bound to loopback. Before any credentials were submitted there, Playwright
confirmed page title Anotto, one exact Anotto brand label and no Renta Copilot brand label. Private
captures remain under `/tmp`; no account content or credentials are included in this report.

## Controlled web validation runner

Node 26.13.0 produced a warning that its localStorage global was unavailable without configuration.
Node 22.23.4 is already installed locally. Before changing tests or application storage code, root
authorized a fresh web suite using Node 22 with `--maxWorkers=2`, preserving the existing tests. The
command sets PATH to the installed Node 22 binary directory so test subprocesses inherit that
version. Command:
`PATH="/Users/inyermarin/.nvm/versions/node/v22.23.4/bin:$PATH" node node_modules/vitest/vitest.mjs run --maxWorkers=2`
from the web repository. Final evidence will be appended after this controlled run; no production
build rerun is required until source changes beyond this correction are introduced.

## Controlled suite final result

The Node 22.23.4 / `--maxWorkers=2` run completed with exit 0: **281/281 test files and 1519/1519
tests passed** in 140.97 seconds. Evidence: `/tmp/anotto-ux-review-2026-11-11/test-full-node22.log`,
command session 20052. All 13 previously failing files passed without test or storage implementation
changes. The earlier Node 26 concurrent-run failures are therefore not reproduced on this controlled
baseline. The web editing freeze was released after this result; subsequent source changes need
their own focused validation.

## Completed authenticated web walkthrough

On 11 November 2026, the existing production build at `http://127.0.0.1:3107` authenticated
successfully using locally configured TEST credentials after application identity was verified.
Playwright visited `/dashboard`, `/transactions`, `/accounts`, `/inbox` and `/documents` at
1440×1000 and 390×844: all ten visits remained on the requested authenticated route, with no
document-level horizontal overflow and no observed JavaScript page errors. All ten screenshots were
visually inspected. Evidence is private:
`/tmp/anotto-ux-review-2026-11-11/auth-readonly-results.json`, `auth-readonly.log` and
`private-{desktop,mobile}-{dashboard,transactions,accounts,inbox,documents}.png`. Do not copy these
captures into the repository or publish them.

Automatic tour popovers initially obscured the content. Only their local Driver close button was
used to reveal the page; source inspection of `hooks/use-automatic-onboarding.ts:107` confirms this
destroys the tour without the preference mutation associated with completing onboarding events. No
financial creation, document upload, review decision or posting action was taken. This walkthrough
covered the visible account-list layout and available empty states; it did not manufacture
transactions/documents or exercise mutation/error fixtures. Browser screenshot geometry is not
native iOS/Android safe-area certification.

### Additional observed findings

- **P2 — Document status group wraps outside its visual container at 390px.** The fourth status tab
  appears below the rounded group background, immediately above the empty card. Evidence: private
  mobile documents capture; W `app/(dashboard)/documents/page.tsx:246` uses `h-auto ... flex-wrap`,
  while `components/ui/tabs.tsx:27` applies a higher-specificity horizontal group height.
  Recommendation: explicitly make the horizontal group height auto at this surface and ensure each
  wrapped trigger has a usable minimum target height; verify the fourth tab's background/focus
  geometry at 320/390px before release. This was subsequently corrected in the Document page
  instance; see the geometry regression evidence below.
- **P2 — Inbox filters dominate the first 390px viewport.** The search row and four expanded filters
  push the empty/result region below the initial fold. Evidence: private mobile inbox capture and W
  `components/transactions/email-inbox.tsx`. Recommendation: consider progressive disclosure of
  secondary filters with a visible active-filter count; preserve named controls and keyboard access.
  This is a density observation, not a demonstrated task blocker.
- **P2 — Dashboard monetary scope remains implicit in the visible summary.** Screenshot labels show
  monetary values without an adjacent ISO currency label; code explicitly formats summary COP in
  `components/dashboard/summary-cards.tsx:89`. Recommendation: label report currency visibly before
  adopting richer currency cards. No incorrect sum or cross-currency conversion was demonstrated by
  this walkthrough.

The controlled Node 22 suite result remains the applicable baseline: 281 files and 1519 tests
passed. Later source changes by other workers require their own validation.

## Document status tabs correction — 11 November 2026

Root authorized the confirmed narrow-screen defect correction. Only the Document page's TabsList and
four TabsTrigger instances changed (`app/(dashboard)/documents/page.tsx:246`); the shared Tabs
component remains unchanged. The page now overrides the horizontal group's fixed height using the
same group variant and gives its triggers automatic height with a 44px minimum. No financial,
intake, review or posting behavior changed.

Before editing, a read-only authenticated Playwright geometry check failed with exit 1: at 320px and
390px the fourth tab extended beyond its parent; all triggers were 29px tall within a 36px list.
After the change the same containment and minimum-height assertions passed. Private screenshots
remain under `/tmp/anotto-ux-review-2026-11-11/private-tabs-{320,390,1440}.png`; the corrected 390px
screenshot was visually inspected.

| Viewport width | Before: list / trigger height | Before: all four contained | After: list / trigger height | After: all four contained |
| -------------- | ----------------------------- | -------------------------- | ---------------------------- | ------------------------- |
| 320px          | 36px / 29px                   | No                         | 94px / 44px                  | Yes                       |
| 390px          | 36px / 29px                   | No                         | 94px / 44px                  | Yes                       |
| 1440px         | 36px / 29px                   | Yes                        | 50px / 44px                  | Yes                       |

Evidence: local `tabs-red.log`, `tabs-green.log` and `document-tabs-geometry.cjs`. Verification used
a separate loopback development server on port 3002 (`.next/dev`), leaving the completed production
build on port 3107 intact. ArrowRight moved focus and selected the second tab at each of 320px,
390px and 1440px; all three keyboard assertions passed with the geometry rerun (exit 0). Focused
existing document tests passed 8/8 (`tabs-focused-tests.log`); scoped ESLint, TypeScript no-emit and
formatting checks passed. No full suite or production build was repeated while root's backend
validation was running; the previously recorded full web baseline remains 281/1519 passing before
later changes.

## Final serial validation after review

The frozen final web sources passed Node 22.23.4 with `--maxWorkers=2`: **282 test files, 1522
tests, exit 0** in 129.12s. Evidence: local `web-final-node22.log` and `web-final-node22.exit`. The
subsequent serial production build also exited 0; authenticated geometry and keyboard checks against
that build passed at 320/390/1440px (`tabs-final-production.log`).

Review then identified the missing Portuguese `transactions.loadError` message. Only that
translation was added to `messages/pt.json:437`, and the key was verified present in English,
Spanish and Portuguese. The focused TransactionList regression passed 3/3, exit 0
(`pt-focused-tests.log`). The full 1522-test result above precedes this translation-only addition;
it was not rerun. A fresh serial Node 22 production build including Portuguese exited 0
(`web-final-build-pt-node22.log` and `.exit`). Only this worker's loopback servers were stopped for
builds. The final production server was restarted at `http://127.0.0.1:3107`; the development server
on port 3002 remains stopped. No deployment or financial mutation was performed.

## Account currency hero implementation — 11 November 2026

The owner clarified the ARQ reference direction: one dominant balance per currency within a unified
hero, horizontal snap navigation, and discreet pagination with an active pill. This supersedes the
initial adjacent-card proposal above. The account-detail implementation replaces its compact chips
and small balance with `components/accounts/account-balance-hero.tsx`; the existing selected ledger
continues to drive account overview, records, editing, and removal in
`app/(dashboard)/accounts/[id]/page.tsx`. Dashboard summary calculation and native mobile behavior
remain unchanged. Each slide displays its own localized balance and ISO currency code; no conversion
or cross-currency sum is introduced. Existing currency-enablement controls remain separate.

Independent review identified an unguarded scroll-end index, missing fallback for browsers without
`scrollend`, and missing alignment after viewport changes. Focused regressions reproduced the
overscroll exception and absent scroll fallback before correction. Settlement now clamps indices,
ignores empty ledgers, debounces ordinary scroll events, cancels pending work on cleanup, and uses
ResizeObserver to align the selected slide instantly after resize. A programmatic target prevents
intermediate smooth-scroll positions from changing the selected ledger. Pointer/wheel interaction
releases that guard. Previous/next, ArrowLeft/ArrowRight, Home/End, pressed-state pagination,
visible keyboard focus, and reduced-motion behavior are supported. Pagination retains 44px targets
and scrolls the active pill into view when many currencies are present.

Focused validation passed **8 tests across 2 files**, including seven hero regressions and the
existing currency-enablement regression; scoped ESLint, TypeScript no-emit, and diff checks passed.
The final full-suite/build pass is coordinated separately after backend validation; earlier full-web
counts above precede this component.

Read-only authenticated Playwright inspected the actual application at loopback port 3002 at
320/390/1440px without document overflow. The test account had no live multi-currency group, so
additional checks intercepted account reads with eight explicitly fictional zero-balance ledgers on
the actual account-detail route. End/Home selection, pagination visibility, resize alignment, and
reduced-motion checks passed at all three widths. A bounded second visual pass confirmed the active
eighth pill remains visible at 320px. This fixture check does not establish live multi-currency data
availability. No financial writes, review decisions, posting, or deployment occurred.

Local evidence remains outside deployment artifacts under `/tmp/anotto-ux-review-2026-11-11/`:
`verification.md`, `real-hero-check.cjs`, `real-hero-{320,390,1440}.png` (private account data), and
`fixture-eight-{320,390,1440}.png` (fictional read fixtures). The independent HTML proposal is
served only on localhost port 4187. Do not publish real-data captures or copy them into this
repository.

### Frozen-source validation including currency hero

After the backend's final validation completed, the final web sources passed Node **22.23.4** with
`--maxWorkers=2`: **283 test files, 1537 tests, exit 0**, in 122.50 seconds. The subsequent serial
production build also exited 0. This count includes the currency hero and supersedes the earlier
pre-hero web count. Local evidence: `web-overnight-tests.log`, `web-overnight-tests.exit`,
`web-overnight-build.log`, and `web-overnight-build.exit` under the private evidence directory
above.

Only this worker's development server on port 3002 was stopped; port 3000 was untouched. The fresh
production build now runs on loopback `http://127.0.0.1:3107` (port 3002 remains stopped). A
login-page identity check returned HTTP 200 with title Anotto and no Renta Copilot brand; evidence:
`web-overnight-identity.log`. No deployment occurred.
