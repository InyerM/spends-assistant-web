# Manual investment tracker delivery

This change addresses the manual Tyba and Binance portion of web issue
[#6](https://github.com/InyerM/spends-assistant-web/issues/6). It is intentionally a separate
journal at `/investments`; shared navigation, account balances, transactions, spending charts, and
net-worth totals remain unchanged.

## Review flow

A person creates a position with a provider, symbol or fund name, quote unit, quantity scale, money
scale, and a source reference. A new position starts at zero. The person then records a reviewed
opening lot, buy, sell, or dated valuation. The form converts decimal text to integer strings
without JavaScript floating-point arithmetic and previews the exact payload. A separate checkbox and
confirmation are required before the API calls `confirm_investment_event`.

An unknown opening cost basis stays unknown: leave the new position empty until supporting evidence
is available. Entering `0` means a verified zero basis, requires a separate acknowledgement, and is
checked again by the RPC. Zero is never used as a placeholder for an unknown opening lot.

Every confirmation has a request UUID. Retrying the same payload returns the saved result; reusing
the UUID for another payload is rejected. The backend locks each position during a trade, uses
weighted-average cost basis, allocates sell basis with explicit rounding, and stores reviewed
evidence and dated values. The table columns storing money and quantity units are text constrained
to 38 digits, so PostgREST never parses them as unsafe JavaScript numbers. Quote units include
three-letter currencies and tokens such as USDT; the position records both precision scales.

The browser and API reject malformed or over-precision amounts. The backend independently validates
amounts and ownership. Authenticated clients can only `SELECT` their own rows; all writes go through
the review RPC. A SQL test script at `supabase/tests/20260929000040_manual_investments.sql` covers
cross-owner access, direct-write denial, precision, and replay. It requires a local Supabase
database after migration `20260929000040_manual_investments.sql`. The migration and review RPC were
exercised in PGlite with synthetic users and records; the full local Supabase test script was not
run because Docker was unavailable.

## Deliberate boundaries

Entries do not post cash movements to bank or provider accounts. A buy or sell changes the journal
position and cost basis only. A valuation is a dated manual snapshot, not a live market price. No
transfer is inferred from a trade; no holding, rate, price, or opening balance is prefilled.
Historical cost basis and dividends need reviewed source records. Connecting these positions to
account cash and net worth requires an explicit no-double-counting model and reconciliation with
existing transactions in a later change.
