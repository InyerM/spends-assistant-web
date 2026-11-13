# Cash-flow currency card

The owner rejected the detached compact currency control and approved Cash Flow as the primary
amount in an ARQ-inspired summary card. This supersedes the earlier Home pager design.

The cash-flow card replaces the previous cash-flow summary tile; it does not add another
account-balance section. It presents signed period cash flow prominently, the selected currency
beneath it, and pagination indicators with previous/next buttons. Horizontal touch gestures and
keyboard navigation select the same shared Home currency. Vertical gestures retain normal page
scrolling. There is no automatic rotation or currency conversion.

Income and expense cards remain secondary. The shared header control appears only if the owner hides
the summary widget, so currency selection remains available without duplicated controls. Custom
charts retain their configured currency and COP-only budgets retain their existing explanation.

Use existing semantic colors, an understated green surface, 44px targets, visible focus,
reduced-motion support and fluid amounts that fit narrow cards. Loading must not show a previous
currency's amount. Preserve the negative cash-flow sign.

Acceptance includes real summary/query synchronization, pagination boundaries, horizontal versus
vertical gestures, single-currency and loading behavior, and visual checks at 320/390/1440px with
negative and long amounts. Native adoption follows the web release; previous compact-header native
artifacts do not implement this approved design.
