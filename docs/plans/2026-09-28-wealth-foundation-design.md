# Investments and loans: web foundation

Status: design and pure calculation foundation only. No database migration, web screen, transaction
rewrite, or user financial data is included in this commit.

## Evidence and current boundary

Web issues [#6](https://github.com/InyerM/spends-assistant-web/issues/6) and
[#7](https://github.com/InyerM/spends-assistant-web/issues/7) require position and liability
records. The platform restart design (`spends/docs/plans/2026-09-28-platform-restart-design.md`,
section 4) recommends asset and liability subrecords. The current `Account` model has `investment`,
`crypto`, and `credit` types but only an aggregate `balance`; `Transaction` has `expense`, `income`,
and `transfer` but no principal, interest, fee, or position allocation. The dashboard balance trend
sums account balances and treats transfers as neutral. An account card can therefore show an
aggregate value, but it cannot explain a Tyba holding, a Binance quantity, or a Lulo or Bancolombia
loan.

## Model choice

Three approaches are possible. Spending categories would wrongly call deposits and principal
repayment expenses. Aggregate account balances cannot explain cost basis, valuation dates, or
payment allocation. Separate position and loan subrecords give each amount an explicit source and
preserve the existing bank account ledger. This foundation implements pure calculations and typed
records for the third approach.

All cash amounts are integer strings in currency minor units; quantities are integer strings in
instrument atoms, with a scale stored on the position. Database columns should use `numeric`, and
API JSON should use decimal strings. A position is denominated in one quote currency. The
calculation uses weighted average cost within that currency; a sell allocates basis proportionally,
rounds to the nearest minor unit, and takes the full remaining basis on final liquidation. Buy fees
increase basis. Sell fees reduce realized return. A dated valuation supplies market value and
therefore unrealized return. Dividends require a separate cash movement and must not be folded into
unrealized return.

A loan has an independently recorded principal balance and reviewed evidence. Disbursement increases
both cash and liability and contributes zero income. A payment explicitly allocates cash paid among
principal, interest, insurance, and fees. Only the latter three are spending; an extra principal
payment reduces liability without adding spending. The pure function never infers the split from the
total payment or a rough interest rate. Rate, term, and projected installment are optional metadata
until a reviewed schedule exists.

## Persistence and review proposal

Add `investment_positions`, `investment_trades`, `investment_valuations`, `loans`, `loan_events`,
and `wealth_transaction_links` in the API repository, each scoped to `user_id` with row level
security and an evidence reference. Manual entry should require provider or lender, currency,
effective date, exact amount, and a reviewed source. A manually entered opening position needs
quantity **and** cost basis; a loan needs a reviewed opening principal. Unknown values remain
unknown. The API should accept an idempotency key for each reviewed event and write its postings and
subrecord update in one transaction.

Tyba or Binance funding should create equal and opposite asset transfer postings. A buy or sell
moves cash inside the provider account and changes quantity and basis. A loan disbursement and
payment should link to the existing bank transaction only after review. The link must prevent
counting the same cash movement twice. No existing transaction should be reclassified or balance
rewritten automatically. Before implementing this link, decide how the current spending dashboard
will exclude a linked principal portion while preserving interest, insurance, and fees.

Net worth should use cash and other account balances, latest reviewed position valuations as of the
report date, and outstanding loan principal. An investment wrapper account balance must be excluded
when its positions and provider cash are included, or it will be counted twice. Totals stay
separated by currency until a dated, sourced FX rate is available. Historical valuations should show
their `asOf` date and should not imply a live price.

## Delivery sequence and checks

1. Port and review the schema and transaction boundaries in the API repository. Define ownership,
   unique event keys, evidence fields, and linkage to existing transactions before any write
   endpoint.
2. Add read endpoints and manual draft forms. Show unknown basis, rate, and valuation as unknown;
   require an explicit review action before persistence.
3. Add reviewed event confirmation RPCs and web projections. Reconcile linked bank movements, then
   extend dashboard totals with a visible valuation date and currency breakdown.
4. Add schedule projection only after rate convention, compounding period, due date, rounding, and
   fee handling are confirmed. Test ordinary installments, extra payments, payoff, and correction
   entries against lender statements.

Current pure tests cover buy and sell with fees, fractional quantity atoms, oversell rejection,
dated valuations, disbursement, payment allocation, extra principal, transfer neutrality, and
separated currency totals. They do not verify database concurrency, broker prices, FX conversion, or
a lender amortization schedule.
