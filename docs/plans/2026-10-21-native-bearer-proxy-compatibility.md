# Native Bearer proxy compatibility

## Failure and scope

Native requests to released owner-scoped web APIs were redirected to the browser login because the
proxy only delegated a small earlier set of Bearer routes. Following that redirect returned HTML
with status 200 instead of the expected JSON. The fix delegates only audited exact paths and methods
to their existing handlers; it never treats the presence of a token as authentication.

`lib/api/mobile-bearer-routes.ts` is the explicit proxy allowlist. UUID path parameters are bounded,
suffixes are exact, and unsupported methods remain behind the existing browser authentication flow.
The previous unrestricted document prefix is replaced by the actual released document operations.
The existing Shortcut intake POST keeps its separate per-user API-key validation.

## Newly covered native web contracts

| Path                                                | Methods     |
| --------------------------------------------------- | ----------- |
| `/api/financial-chat/history`                       | GET, DELETE |
| `/api/contacts`                                     | GET, POST   |
| `/api/contacts/:uuid`                               | GET, PATCH  |
| `/api/accounts/:uuid/activity`                      | GET         |
| `/api/accounts/:uuid/currencies`                    | POST        |
| `/api/fx-reference`                                 | GET         |
| `/api/statements/proofs`                            | GET         |
| `/api/transactions/category-review`                 | GET         |
| `/api/transactions/:uuid/analyze`                   | POST        |
| `/api/transactions/:uuid/category-review`           | POST        |
| `/api/transactions/:uuid/category-followup`         | GET, POST   |
| `/api/transactions/:uuid/category-followup/explain` | POST        |
| `/api/transactions/:uuid/category-followup/review`  | POST        |
| `/api/transactions/:uuid/duplicate-review`          | POST        |
| `/api/transactions/:uuid/funding-correction`        | POST        |

These handlers already call `getUserClient(request)` and preserve their own schema validation, owner
checks, reviewed financial RPCs, and browser origin checks. A source contract regression verifies
that every newly delegated method still passes its actual Request to authentication.

Worker-only native routes are not added to the web proxy. Cookie-only `/api/email-forwarding`
remains excluded; native setup uses the existing authenticated Worker endpoint. Unsupported inbox
financial routes remain excluded because native uses audited owner RPCs directly.

## Authentication invariants

The shared Bearer branch in `lib/api/server.ts` verifies the access token with Supabase, uses the
public anon client and user RLS, rejects malformed/expired tokens without cookie fallback, and
enforces mandatory terms acceptance. It now also enforces the same eligibility attestation checked
by the browser proxy. Account deletion remains available before terms/eligibility declarations,
matching the existing browser exemption. No financial posting logic or owner-scoped SQL authority
changes.

## Final validation after the FX GET addition

Validation was repeated on October 21, 2026, after adding the exact FX GET contract:

| Gate                                                                     | Result                                                                                                          | Evidence                                                   |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Full web tests, existing timeouts, two workers                           | 275 files, 1,482 tests passed                                                                                   | `/tmp/anotto-web-native-candidate-final-tests-bounded.log` |
| TypeScript                                                               | Passed                                                                                                          | `/tmp/anotto-web-native-candidate-final-typecheck.log`     |
| Full ESLint                                                              | 0 errors, 1 pre-existing React Hook Form compiler warning at `components/transactions/transaction-form.tsx:184` | `/tmp/anotto-web-native-candidate-final-lint.log`          |
| Production build                                                         | Passed                                                                                                          | `/tmp/anotto-web-native-candidate-final-build.log`         |
| Focused proxy, authentication and route contract tests after FX addition | 3 files, 104 tests passed                                                                                       | `/tmp/anotto-proxy-fx-focused.log`                         |

The original proxy regression reproduced 22 failures before the allowlist change. The eligibility
regression failed before the shared Bearer eligibility check. An initial unrestricted full run
alongside the production build had UI timeouts and subsequent assertion failures; the final bounded
full run above passed without changing application source, test fixtures, or deadlines.

The historical USD/COP estimate delegates only `GET /api/fx-reference?date=YYYY-MM-DD`; its actual
Request is authenticated by the released handler. Cookie-only `/api/fx/reference-rate` and all FX
writes remain excluded.

## Authorized publication scope

The starting checkout was clean on `main` at `6717b0b`. The candidate contains exactly these seven
files:

- `proxy.ts`
- `lib/api/mobile-bearer-routes.ts`
- `lib/api/server.ts`
- `tests/proxy.test.ts`
- `tests/lib/api/mobile-bearer-routes.test.ts`
- `tests/lib/api/document-mobile-auth.test.ts`
- `docs/plans/2026-10-21-native-bearer-proxy-compatibility.md`

On October 21 the user explicitly approved publishing only this prepared compatibility adjustment
with “Sí, publicar el ajuste (recomendado)”. Publication uses the existing linked Vercel project
`spends-assistant-web` and its production aliases. No database migration, financial-data mutation,
Worker release, native binary release, or unrelated source change belongs to this authorization.

The production acceptance check must verify the committed candidate deployment and read-only native
Bearer JSON contracts. Test credentials and session tokens remain in memory; evidence records only
HTTP status, content type, redirects, deployment identity, and validation results. The prior
production deployment is `dpl_8x5WGMqCjKELj5sopYqghSvoT5mb` and remains the rollback reference.
