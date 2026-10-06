# Merchant enrichment and card evidence

## Evidence

- The reviewed Tiendas Ara forwarded purchase was recorded as `groceries`, but the web suggestion
  used only two or more similar transaction descriptions. A first purchase and a transaction
  described merely as "Compra realizada" therefore provided no merchant category evidence. The
  initial catalog now suggests the owner's active `groceries` category for exact Tiendas Ara and
  Mercamas aliases.
- Bancolombia forwarding contained legitimate card/account suffixes and dates, but a security footer
  triggered broad numeric redaction. The backend now removes only a security code adjacent to a code
  label. Five of seven pending Bancolombia messages inspected on 2026-10-05 already contained
  `[number omitted]`; the missing digits cannot be reconstructed from stored text.
- The Lulo preview now decodes HTML entities in historical as well as newly forwarded notices.
  Template completeness remains distinct from bank authentication; no AI result may establish an
  account identity.
- The web creation form now suggests a Bancolombia account only for one explicit credit/debit suffix
  and one active owned COP account of the matching type. It does not parse or automatically post a
  Bancolombia transaction.

## Recommended resolution order

1. **Verified evidence:** parse the notice with a bank-specific adapter. Select an account only when
   bank, account type, and visible suffix identify exactly one active owned account. Preserve the
   original evidence and distinguish email receipt time from bank event time. Ambiguous matches
   remain for review.
2. **Owner memory:** add an owner-scoped merchant profile table keyed by normalized aliases. Only an
   explicit reviewed category correction can create or update a profile. Record the category, source
   decision, alias, and revision; conflicting decisions return to review. Never train on rejected,
   unverified, or automatically posted items.
3. **Curated catalog:** keep a small versioned set of merchants with a stable primary spending
   purpose. Match complete names or bounded branch suffixes, not arbitrary substrings. Resolve the
   category slug against the owner's active expense taxonomy. Generic categories are not eligible
   for automatic posting.
4. **Model proposal:** supply a bounded merchant name and the owner's allowed categories to the
   metered text model. Self-reported confidence is a screening signal, not proof. Calibrate
   thresholds against reviewed labels before widening automatic posting.
5. **Grounded lookup for unknown businesses:** search only a normalized business name and country,
   never an amount, card suffix, email body, personal contact, or account number. Use a single
   bounded OpenRouter web-search request, cache a reviewed merchant profile, and retain source URLs
   and timestamps. Search snippets are untrusted input. A result without a corroborating business
   source stays a proposal. OpenRouter's
   [web-search server tool](https://openrouter.ai/docs/guides/features/server-tools/web-search) is
   currently beta and charges search separately from model tokens; the deprecated web plugin is not
   the target API.

## Next implementation slices

1. Build bank-specific web previews for Bancolombia card purchases and transfers, then other
   observed senders. Test redacted fixtures from each template and require a unique owned-account
   match. Do not enable automatic financial posting for a new bank adapter in the same release.
2. Add the owner-scoped merchant profile schema, audited update RPC, and a small review control that
   asks whether a corrected category should be remembered for future purchases. Show the evidence
   behind every suggestion and an option to clear a learned profile.
3. Add optional grounded business lookup after local evidence fails. Meter actual USD and query
   counts, cap search attempts per merchant, and evaluate against a reviewed merchant test set. Keep
   the existing internal budget as an observability target rather than a user-facing hard rejection.
4. Offer a deliberate re-import flow for older redacted forwarded notices. Never overwrite an
   existing review or post a transaction merely because the newer raw text contains previously lost
   digits.

No catalog or model can infer the items bought at a multi-purpose retailer from a merchant name
alone. The interface should show a suggestion and its source, while uncertain or contradictory
evidence remains in review.
