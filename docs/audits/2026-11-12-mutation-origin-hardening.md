# Cookie mutation origin hardening — 12 November 2026

## Local result and release boundary

A09 now has a locally implemented shared mutation-authentication boundary and compatible response
headers. Every one of the **82 exported unsafe API handlers** passes its Request through the
relevant authentication path, including shared forwarding, wealth and Shortcut wrappers. A recursive
source gate and an actual-route denial sweep cover that inventory. This is scoped local hardening,
not complete backend/web/mobile security assurance or evidence of production publication.

The implementation follows
[the approved next gates](../../../spends/docs/plans/2026-11-12-security-next-gates.md) and
[the security audit](../../../spends/docs/audits/2026-11-12-security-followup.md). No financial
posting, database privilege change, paid provider call, dependency update, OAuth callback change or
native implementation was added. Publication remains with the release coordinator after independent
review and the production acceptance gate.

## Authentication behavior

`lib/api/server.ts:11` gives known `AuthError` instances a constrained 401/403 status. The existing
`getUserClient(request)` is the shared boundary rather than introducing a second overlapping
authentication API:

- For unsafe cookie methods (`POST`, `PUT`, `PATCH`, `DELETE`), exact origin is required before
  constructing a cookie-authenticated database client. Missing, null, malformed, foreign and
  same-site sibling origins fail with **403 Invalid request origin**.
- Authorization-bearing requests must use an exact method/path in the existing mobile bearer
  allowlist, then pass normal JWT verification and legal/eligibility checks.
  Invalid/malformed/unallowlisted credentials never fall back to a valid cookie. The allowlist
  itself and proxy delegation were not broadened.
- Shortcut `sk_*` intake keeps its separate active hashed-key verification. Its cookie fallback now
  forwards Request to the same central boundary (`lib/shortcut-inbox/auth.ts:13`); header presence
  alone does not validate a key.
- Read/server-component calls may retain requestless authentication. All unsafe route exports now
  preserve Request, including `lib/wealth/manage-record-route.ts` and
  `app/api/email-forwarding/route.ts`. Route error handling propagates origin status only from known
  AuthError instances; arbitrary exceptions cannot supply an HTTP status.

`lib/api/request-origin.ts:3` compares scheme, host and effective port. It rejects origins
containing credentials, paths, query, fragment, commas or unsupported protocols; canonical host
case/default ports remain equivalent. Production Host/Forwarded headers cannot redefine a public
target. Explicit loopback-to-loopback Host normalization is retained for both development and a
production-mode local preview, because Next's local listener address can differ from the browser's
loopback address. External Host values cannot use that exception. No missing-Origin compatibility
exemption was introduced.

Existing local route checks use the same normalization. OAuth/recovery GET callbacks and their
cookie/code exchange are unchanged. Explicit bearer dispatch to the Worker remains separate from
cookie mutation authentication.

## Compatible response headers

`next.config.ts:7` sets the following on all paths:

| Header                  | Value                             |
| ----------------------- | --------------------------------- |
| X-Content-Type-Options  | `nosniff`                         |
| Referrer-Policy         | `strict-origin-when-cross-origin` |
| Content-Security-Policy | `frame-ancestors 'self'`          |
| X-Frame-Options         | `SAMEORIGIN`                      |

This only restricts embedding Anotto itself. It does not add script/font/connect/frame resource
restrictions, COEP/COOP or new HSTS scope. Existing signed-storage PDF child frames and their
explicit `no-referrer` policies remain intact. A frame-ancestors-only policy is not a full XSS
policy.

## Tests and independent findings

The initial new origin/authentication/header tests failed in **12 cases**, and the recursive
unsafe-route gate separately failed before implementation. Evidence:
`/tmp/anotto-security-followup-20261112/a09-red.log` and `a09-inventory-red.log`. A production-mode
loopback compatibility regression was also observed failing before the narrow normalization
adjustment (`a09-localhost-red.log`).

The first full candidate passed **299 files / 1,615 tests**, TypeScript and scoped ESLint. Evidence:
`a09-full-tests-first.log` (141.40 seconds), `a09-typecheck-final.log`, `a09-lint-second.log`. Root
and the separate pipeline reviewer inspected the shared boundary, origin trust, native consumers and
wrappers without editing source.

Independent review then found one status-mapping omission in
`app/api/accounts/[id]/balance/route.ts`: the central guard blocked side effects, but its catch
converted 403 to 401. A new real-route regression failed first (`a09-balance-red.log`), then the
handler was corrected to preserve the constrained status. The final focused run passed **107 tests
in eight files** (`a09-final-focused-tests.log`). This includes an executable sweep of **all 82
unsafe exports**, using valid synthetic request shapes to reach their authentication boundary,
asserting 403 and zero cookie/admin client construction, RPC, storage signing or provider calls. The
recursive source gate separately follows local/imported wrappers and rejects dropped Request context
and unreviewed unsafe alias/variable exports.

The focused cases retain valid cookie mutations, verified native JWT without Origin, invalid JWT
plus valid cookies, valid JWT on unallowlisted paths, Shortcut key behavior,
sibling/foreign/null/missing origin rejection, host spoofing defenses and equivalent/default-port
origins. Existing proxy/owner/review tests remain green. The full suite above predates the final
one-line balance response correction and two added denial assertions; it is recorded as dated
evidence, not a falsely relabeled full run of the later snapshot.

## Build and runtime evidence

The first candidate production build succeeded in the isolated `/tmp/anotto-a09-build-20261112`
tree. Dependencies were copied locally with filesystem cloning, without installation or scripts, and
the running workspace `.next` was preserved. Existing ignored environment configuration was loaded
into the build/server process without copying its file into the candidate. Source fingerprints were
unchanged across the build (`a09-build-source-manifest.json`); built header rules are recorded in
`a09-built-header-evidence.json`.

At `2026-11-12T21:00:59Z`, its anonymous local login returned 200 and an unauthenticated API request
returned the expected 307; both carried all four headers (`a09-anonymous-local-smoke.json`). The
pipeline owner subsequently reported **passed local acceptance** in
`/tmp/anotto-a09-local-acceptance-20261112.json`: actual browser-cookie login, legitimate language
mutation, denied foreign/sibling/missing/null origins, invalid bearer plus cookie denial,
unallowlisted valid bearer denial, allowlisted native settings without Origin, audio JavaScript MIME
and signed synthetic PDF preview. No provider/OCR call or financial write occurred; exact synthetic
fixtures were cleaned by that harness owner.

A replacement isolated build including the balance status fix is being prepared at
`/tmp/anotto-a09-build-v2-20261112`. Its final build/start evidence and the production
publication/acceptance result must be recorded by the coordinator before marking this change
released. The local runtime acceptance does not establish deployed origin/forwarded-header behavior;
the same bounded production harness remains required, with an added balance-origin denial and no
financial operation.

## Residual scope

A09 coverage here concerns the authenticated web API mutation inventory and the listed response
headers. It does not repair A07 legacy financial grants/service-role posting, A10 unbounded
matching, native OAuth/signing/backup, every possible frontend XSS sink, or undocumented external
integrations. The independent compatibility review found no legitimate cookie-without-Origin
background consumer in the searched app/lib paths; a future such consumer needs explicit verified
credentials, not a broad origin bypass.
