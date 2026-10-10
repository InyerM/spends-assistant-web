# Bank-independent email review audit

## Scope and findings

Owner-authorized audit on 2026-10-09: 218 forwarded emails examined privately. No private messages
or identifiers are included in this document. No financial postings were changed.

- The AI suggestion contract had no amount or independent event-date fields. Unsupported templates
  could never receive these fields from AI.
- Web draft generation, candidate discovery, native prefill and backend triage used different
  template-specific readers.
- Version-2 cached proposals bypassed enrichment, including incomplete proposals. Stored extraction
  evidence is immutable by design; repairs must be response overlays and annotation updates, never
  silent fact rewrites.
- The new conservative evidence reader found 158 amounts, 152 dates and 154 clocks independently. It
  can recover missing stored amounts in 37 analyzed messages and clocks in 29. Nineteen messages
  contain conflicting/multiple monetary or event signals and need review; these counts are coverage
  observations, not independently labeled extraction accuracy.
- Cloudflare audit from 2026-10-09 05:00 UTC to the audit request returned 11 suggestion failures:
  six truncated responses, three invalid JSON responses without a stage and two invalid envelope
  JSON responses. Historical logs do not establish whether a particular email's absent field was a
  provider error or a parser miss.
- A scheduled invoice payment can be financial despite an `Informativa` header. The reported payment
  contains amount and date but no explicit hour. Tracking IDs and delivery times cannot establish
  the transaction hour.

## Changes

One dependency-free evidence reader is mirrored with identical executable semantics into web and
native with `scripts/sync-email-evidence.ts`. It does not inspect bank sender domains. Each field is
nullable independently. It accepts completed financial events, separates balance amounts, strips
delivery metadata and service footers, rejects unsettled messages and withholds conflicting facts.
Model-proposed amounts/dates/source suffixes require an exact supporting quotation and validated
numeric/calendar values. Existing forwarding verification and owner authorization remain mandatory
and independent of parsing.

Explicit Analyze actions request fresh enrichment. Current rules and recipient history retain
precedence. Candidate discovery and reviewed forms share source evidence; final owner-scoped SQL
duplicate checks remain authoritative. No automatic posting is enabled.

Optional merchant research sends only a bounded public purchase-merchant name and category names to
a separate request. It never sends raw email, transaction amount, dates, account numbers or
recipient identifiers to search. One search with three results and a ten-second budget is permitted,
without retries. Category acceptance requires a matching upstream citation, an owned category,
business identity and >=95% model confidence. Unknown or failed search leaves the category for
manual review. Web lookup cannot change amount, date or time. Its calls use existing consent and
usage recording.

OpenRouter extraction requests disable unnecessary reasoning, use compact JSON and retain bounded
malformed/truncated recovery. Provider zero-retention/training restrictions remain enforced.

## Verification

Synthetic corpus covers scheduled invoice payments without clocks, incoming transfers, QR, card
purchases, international and Colombian separators, COP/USD, numeric/text dates, AM/PM, headers,
footers, balances, rejected payments, promotions, unpaid invoices and multi-event ambiguity.
Owner-scoped route tests cover cached evidence repair without modifying immutable financial facts.
Public merchant tests reject fabricated citations and identifier/instruction searches.

No extractor or LLM can guarantee correct inference for every future template or facts absent from a
message. The contract is partial evidence, explicit ambiguity, safe fallback and owner confirmation.
New unsupported formats must become anonymized regression cases before changing extraction rules.

## Public documentation

- [OpenRouter web search server tool](https://openrouter.ai/docs/guides/features/server-tools/web-search):
  capped search calls/results and upstream citations.
- [OpenRouter DeepSeek guidance](https://openrouter.ai/blog/insights/why-openrouter-for-deepseek/):
  reasoning toggle for non-reasoning requests.

## Reviewed transaction deletion follow-up

Migration 20261009000040 permits owner-scoped soft deletion of transactions linked to
emails/documents. Review decisions and source links remain intact, deletion is append-only audited,
account balances reverse atomically once, and retries do not reverse them again. Existing wealth
allocation guards remain authoritative. The inbox retains its current filters and the acknowledged
email shows its matched transaction immediately.
