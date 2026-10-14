# Unified review query, large summary amounts and saved layouts

## Root cause and changes

The sidebar pending count included every source, but the list API retained its legacy default of
excluding forwarded email. The unified page now explicitly sends source=all, and the owner-filtered
API includes email and shortcuts for that mode. The legacy shortcuts-only default and the verified
email-only mode retain their previous behavior. Regression tests cover three pending owner sources
and exclude a foreign owner's row.

The source-configuration action sits alongside the page title. Message filter/search labels now
describe messages rather than email only.

Summary amount text uses the card container width and the longest formatted value to choose its
size. Icons and labels occupy their own header, allowing amounts to use the entire card width.
Narrow widget containers stack cards and wrapping prevents extreme values from overflowing. Totals
and financial calculations are unchanged.

The dashboard drawer supports up to five named distributions. Saving a named snapshot does not
replace the active home layout. Selecting one changes the draft; the main Save action applies it.
Existing names can be updated, named distributions can be removed, and reaching capacity does not
silently delete another distribution. Preferences persist through the existing authenticated,
owner-scoped planning command; no financial transactions are created.

## Validation

- Focused failing tests preceded the unified source and saved-layout changes.
- Full web suite: 235 files, 1,325 tests passed.
- Typecheck and production build passed; source lint has no errors and retains one existing React
  Hook Form compiler warning.
- Authenticated Playwright used a disposable synthetic owner and three real pending inbox records
  from email, SMS shortcuts and Apple Pay sources. Both the API count and visible list returned
  three. The source action was adjacent to the title. Reviewing a message updated the sidebar and
  widget count to two without invalidating all inbox list queries.
- Synthetic large-value transaction responses tested summary cards at 1440px, 1100px and 390px;
  there was no horizontal text or page overflow. These responses did not post financial records.
- A named layout was saved, survived reload, applied, saved as the active layout and verified again
  after reload. Browser runtime errors were absent and the synthetic owner was deleted.

## Owner acceptance

Reload To review and confirm the three messages are visible. Open Edit home, name the current
distribution and save it. Change the draft, reapply the named distribution and press Save; reload to
verify it remains active. Check large amounts while the drawer is open and after it is closed.

## Pending-review widgets and account setup

Two optional compact widgets are available in Edit home: Inbox to review and Pending documents. They
use the same owner-scoped counts as navigation and expose View more links. They are not added to an
existing layout automatically. Count announcements include the widget context, and lookup failures
show unavailable rather than zero. Settings module rows include decorative icons with their existing
text labels.

Pending messages with clear own-account or card references offer Create account or Link to an
existing account. This uses grounded text references and preserves credit/debit/bank-account
distinctions. Full explicit own-account numbers are reduced to their final four digits. Transfer
beneficiaries, incoming sender accounts and conflicting own references do not produce setup
suggestions. Existing active aliases suppress the suggestion; linking reactivates an existing alias
without duplication and preserves an active primary identifier.

Creating uses the existing account dialog with its detected identifier prefilled; linking requires a
separate confirmation and saves only account identifiers through the existing account mutation. The
user still confirms financial posting in transaction review. Account/rule caches refresh afterward.
No recognition network call, automatic account creation, automatic linking or financial posting was
added.

Grounded source and alias regression tests cover own origin versus beneficiary, credit versus debit,
active aliases, full own-account numbers, incoming payer accounts and ambiguous references. A live
disposable-owner browser check linked an origin identifier and created a credit-card account through
the UI; the owner's transaction count remained zero.

The complete local browser check also verified both pending widgets, settings icons, account
linking, account creation, named-layout reload and zero financial posting. It reported no page
errors and confirmed synthetic-owner cleanup.

## Production release

Released on 2026-10-13 at https://my.anotto.app. Vercel deployment
`dpl_2DFD6hTtjuUCku54rvYdoN8PjxRN` reached READY with application commit `f4968c9`. Deployment
inspection: https://vercel.com/inyerms-projects/spends-assistant-web/2DFD6hTtjuUCku54rvYdoN8PjxRN.

Authenticated production Playwright verified three-source queue/count agreement, source-action
placement, own-account identifier linking, credit-card creation, immediate review counter updates,
large amounts at three viewport sizes, optional pending widgets, named-layout save and reload, and
settings icons. No page errors occurred, account setup posted zero financial transactions, and the
disposable synthetic owner was deleted. Private QA fixtures and reports remain outside the
repository.
