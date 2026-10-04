# Anotto customer-facing brand plan

Status: approved customer-facing web migration in progress. The owner selected Void Emerald with
Amber and `anotto.app`. Internal identifiers and financial data remain unchanged.

## Decision to make

The owner approved direction A's typography, layout, and three-bar wordmark, the near-black **3 ·
Void Emerald** base, and **3 · Amber** from the
[secondary-color studies](../design/anotto/a-variants/secondary/index.html). The public hostname is
`anotto.app`. The production token contract is in [`DESIGN.md`](../../DESIGN.md), and the
[web migration plan](2026-10-03-anotto-web-rollout.md) tracks implementation and release checks.

| Direction                                    | Visual logic                                               | Working colors                                           | Primary trade-off                                                             |
| -------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [A · Forest](../design/anotto/a-forest.html) | Spacious dark workspace and calm money overview            | Forest `#0C1714`, surface `#193127`, mint `#B2E5B6`      | Most continuous with today's dark app; needs careful secondary-text contrast. |
| [B · Ledger](../design/anotto/b-ledger.html) | Warm paper, ink green, clear transaction records           | Paper `#F4F4ED`, pine `#175C42`, sage `#DCEACB`          | Strong daylight readability; dark-mode counterpart must be designed.          |
| [C · Signal](../design/anotto/c-signal.html) | Compact operations view with transaction and review status | Graphite `#0D1718`, deep green `#194536`, mint `#A5DCBC` | Higher information density; narrower layouts need deliberate priority rules.  |

The follow-up variants all retain A's Manrope typography, spatial organization, and wordmark
geometry. They adapt ideas from the owner-supplied Harness and Tinybird style references to a
financial application; they do not reproduce either site's page layout or assets.

| Variant                                                             | Neutral canvas | Accent role                                  | Distinguishing treatment                                          |
| ------------------------------------------------------------------- | -------------- | -------------------------------------------- | ----------------------------------------------------------------- |
| [1 · Carbon Mint](../design/anotto/a-variants/preview.html?v=1)     | `#08090B`      | Mint `#91DFBE` for actions and positive data | Luminous card edges on a nearly black canvas.                     |
| [2 · Graphite Sage](../design/anotto/a-variants/preview.html?v=2)   | `#0E0F11`      | Soft green `#C4DEA1` for controls and chart  | More subdued panels and pill details.                             |
| [3 · Void Emerald](../design/anotto/a-variants/preview.html?v=3)    | `#060708`      | Emerald `#64D59F` for status and chart       | White primary action and minimal panel borders.                   |
| [4 · Phosphor Review](../design/anotto/a-variants/preview.html?v=4) | `#0B0D11`      | Mint `#A3DFC5` for one review panel          | One illuminated task panel within an otherwise neutral workspace. |

The secondary-color studies keep option 3's shell, white primary action, emerald navigation and
positive signals, wordmark, and layout fixed. They apply one alternative hue to the review panel's
supporting details and the spending data series, so their visual effect can be compared in the same
places. Those uses are exploratory; a final semantic role map is still required. The working
selection is **Amber**. Keep warning separate with a stronger orange, icon, and explicit label.

| Study                                                               | Secondary color | Intended direction                    | Main caution                                                |
| ------------------------------------------------------------------- | --------------- | ------------------------------------- | ----------------------------------------------------------- |
| [1 · Cobalt](../design/anotto/a-variants/preview.html?v=3&s=cobalt) | `#94B9FF`       | Familiar information and account data | May make the product look like a generic banking dashboard. |
| [2 · Iris](../design/anotto/a-variants/preview.html?v=3&s=iris)     | `#C0B0F2`       | Review and assistant context          | Keep the hue limited so it does not compete with the green. |
| [3 · Amber](../design/anotto/a-variants/preview.html?v=3&s=amber)   | `#E8BE78`       | Wealth and planning warmth            | Reserve a distinct warning treatment.                       |
| [4 · Coral](../design/anotto/a-variants/preview.html?v=3&s=coral)   | `#F2AFAE`       | Human warmth and outgoing data        | Reserve a distinct error/destructive treatment.             |

The palette should be assigned by interface role rather than scattering hues across features. Wise's
public rebrand describes green alongside punchy secondary colors; Mercury describes semantic color
tokens for its dark mode; and Stripe documents its contrast system for dashboard text and icons.
These examples support a restrained second hue with explicit usage rules, not copying those brands'
assets. Sources:
[Wise brand](https://wise.com/gb/blog/a-brand-for-everywhere-wise-unveils-bold-new-look),
[Mercury dark mode](https://mercury.com/blog/december-2022-product-updates),
[Stripe accessible color systems](https://stripe.com/blog/accessible-color-systems).

The concepts use fabricated figures and activity. They are isolated HTML previews, not product
routes or functional transaction screens. The proposals borrow **principles** from public product
writing, not brand assets or UI layouts: Wise describes a green-led brand system, Mercury emphasizes
usable transaction views and financial insight, and Monzo describes a customizable overview with
unified activity. Sources:
[Wise brand](https://wise.com/gb/blog/a-brand-for-everywhere-wise-unveils-bold-new-look),
[Mercury transactions](https://mercury.com/blog/updated-transactions-page),
[Monzo home](https://monzo.com/blog/the-new-and-improved-home-screen).

## Scope and boundaries

Change only what customers see: product name, wordmark/icon, copy, colors, typography, visible email
and bot text, app display name, metadata, and customer-facing domain. Keep repository names, package
names, database identifiers, migrations, internal service names, API paths, Worker name,
environment-variable names, Expo slug and bundle/package identifiers, and existing integration keys
stable. A new public hostname may require DNS, Vercel, callback-URL, cookie, and redirect
configuration; those supporting changes do not rename internal interfaces.

Retain current financial behavior, owner-scoped review, duplicate detection, and explicit approval
before financial posting. Brand work must not change how a forwarded bank message or document
becomes a transaction.

## Current customer-visible inventory

| Surface                                  | Evidence                                                                 | Planned change                                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Web browser title and description        | `app/layout.tsx`                                                         | Anotto title template, localized description, social metadata.                                                                              |
| Web login and primary navigation         | `app/(auth)/login/page.tsx`, `components/layout/sidebar.tsx`             | Wordmark, recognizable icon, chosen visual tokens, localized product copy.                                                                  |
| Web icon and global palette              | `app/icon.svg`, `app/globals.css`                                        | New approved icon and semantic light/dark tokens; no scattered brand hex values.                                                            |
| Guided email forwarding                  | `messages/email-forwarding.en.json`, `.es.json`, `.pt.json`              | Replace customer-visible “Spends” copy in all three locales; preserve the private forwarding address until the hostname migration is ready. |
| Backend Telegram welcome/help            | backend `src/handlers/telegram.ts`                                       | Replace visible “Expense Assistant” name only; keep bot/API identifiers and commands stable.                                                |
| Mobile app display and subscription copy | mobile `app.json`, `src/i18n/{en,es,pt}.json`, mobile icon/splash assets | After the web release, change display name, user-facing copy, and approved assets; retain Expo slug, URL scheme, and app identifiers.       |
| Customer domain                          | current `spends-assistant.inyerm.com`; approved `anotto.app`             | Set up the new website hostname after deployment checks; keep legacy deep links and forwarding operational.                                 |

Documentation and operational logs are internal and do not need a wholesale string replacement.
Historical records, stored source text, audit events, and third-party bank names must remain
untouched.

## Release sequence

1. **Approve a direction.** Review desktop and mobile renders, refine the chosen green, define its
   accessible states, wordmark/icon, typography licenses, and light/dark treatment. Record one final
   token map and localization voice in English documentation.
2. **Release web first.** Update shared theme tokens and visible brand surfaces through existing UI
   components and locale files. Audit login, dashboard, transactions, review inbox, documents,
   investments, loans, receivables, help and settings for contrast, overflow, and old product copy.
   Add focused tests for title and localized copy; run typecheck, lint, tests, and production build.
3. **Release customer communications and domain.** Update Telegram welcome/help and any other
   verified customer-facing message. Add the approved hostname, check auth redirects, TLS, and email
   forwarding/verification against the new domain. Keep the old web hostname redirecting, and keep
   the existing receipt address valid during transition. Run a real forwarding smoke test after DNS
   propagation.
4. **Release mobile after web review.** Apply the locked visual system to NativeWind tokens and
   assets, update display name and all locale copy, and test existing deep links, offline data, and
   store upgrade behavior. Do not disturb the currently dirty mobile working tree until its owner
   has resolved that work.

## Acceptance and evidence

- A customer can identify Anotto consistently in the browser, login, dashboard, review flow, mobile
  launcher, and any email/bot message they receive.
- Search of production UI and locale sources finds no unintended “Spends Assistant,” “Expense
  Assistant,” or “Expense Tracker” customer-facing copy; internal identifiers are intentionally
  excluded.
- Contrast, keyboard focus, responsive layout, and light/dark states pass an accessibility review at
  desktop and phone widths. The review uses actual application screens, not only these concepts.
- Login, deep links, new email forwarding, document review, and transaction approval still work
  after the public hostname change.
- Existing users keep their accounts, transactions, documents, forwarding address, and mobile
  offline data across the rollout.

## Open decisions

1. Verify the production web build and financial review flows before pointing `anotto.app` to
   Vercel. Keep `spends-assistant.inyerm.com` available during the transition.
2. Decide when the old website hostname should redirect to `anotto.app` after the new address and
   existing receipt forwarding have passed live tests. Recommend a later redirect, not part of the
   first DNS change.
