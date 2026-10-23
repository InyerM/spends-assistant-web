# Automatic inbox analysis: web release checklist

Date: 2026-10-22. Status: implementation, complete baseline suite, focused post-review gates, final
production build and independent web security review passed. Production release and authenticated
runtime acceptance remain pending. No deployment, commit, live AI request, or production inbox
mutation was performed by this implementation task.

## Delivered changes

- `GET /api/shortcut-inbox` enriches the visible page with two batched owner-filtered reads for
  persisted v3 proposals and allowlisted job status. Lease tokens and unrecognized analysis details
  are never returned. The page preserves its existing match-decision enrichment and private response
  policy.
- React Query polls every 2.5 seconds only when visible jobs are pending/running. Preparing,
  ready-to-review, and manual-review labels explain that suggestions do not post money. Suggested
  category names reuse the category query, rather than one server request per item.
- Opening a prepared item uses its cached proposal immediately, without another AI call. An explicit
  refresh action remains available. Existing form overrides preserve manual description, notes,
  time, account and category edits when a proposal arrives. Transfer metadata selects a transfer
  draft; destination defaults require distinct active owned COP account options, while financial
  confirmation remains authoritative in the existing reviewed SQL function.
- Accepted intake schedules a best-effort authenticated `/inbox/analysis-dispatch` wakeup through
  Next.js `after()`, using at most 25 newly received IDs per request. The response does not wait for
  AI. The caller's Bearer credential or current cookie session JWT is forwarded only in memory; the
  static Worker key is not used. Durable database jobs survive a failed wakeup. Cookie intake
  rejects cross-origin requests before storage or scheduling.
- The analysis route supports all sources through `/inbox/analyze`, validates a bounded request and
  owned inbox ID, and immediately returns cached v3 proposals. It preserves 202 pending/running,
  current consent errors, a sanitized quota contract, and other failure status codes. Only an
  explicit plain `404 Not Found` indicating an absent legacy Worker route permits email-only
  fallback; a JSON missing-item response, consent failure, quota failure or outage cannot change
  consent scope.
- The generic transaction parse adapter supports validated native Bearer sessions, rejects
  cross-origin cookie requests before session/provider work, and initializes automation notes from
  the Worker's optional validated purpose note (at most 500 characters), so `add_note` appends. It
  bounds actual JSON bytes and rejects invalid text or text exceeding 16384 characters. Legacy
  responses without notes remain compatible.

## Local evidence

| Gate                                                | Result                                                     | Evidence                                                                                                         |
| --------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Initial analysis behavior                           | Expected RED before implementation                         | `/tmp/anotto-web-analysis-red.log`                                                                               |
| Canonical and polling behavior                      | Expected RED before implementation                         | `/tmp/anotto-web-canonical-red.log`                                                                              |
| Dispatcher behavior                                 | Expected RED before implementation                         | `/tmp/anotto-web-dispatch-red.log`                                                                               |
| Cached review and explicit refresh                  | Expected RED before implementation                         | `/tmp/anotto-web-inbox-cached-red.log`, `/tmp/anotto-web-refresh-transfer-red.log`                               |
| Native Bearer and purpose-note preservation         | Expected RED before implementation                         | `/tmp/anotto-web-parse-notes-red.log`                                                                            |
| Byte bounds, quota privacy and cookie intake Origin | Expected RED before implementation                         | `/tmp/anotto-web-bounded-json-red.log`, `/tmp/anotto-web-quota-red.log`, `/tmp/anotto-web-intake-origin-red.log` |
| Focused regression suite                            | 11 suites, 119 tests passed                                | `/tmp/anotto-web-inbox-focused.log`                                                                              |
| Complete suite, maximum two workers                 | 279 suites, 1510 tests passed before review corrections    | `/tmp/anotto-web-analysis-all-tests.log`                                                                         |
| Review corrections                                  | Expected RED (6 failures), then 5 suites / 81 tests passed | `/tmp/anotto-web-review-fixes-red.log`, `/tmp/anotto-web-review-fixes-green.log`                                 |
| Post-review typecheck and scoped ESLint             | Passed, exit 0                                             | `/tmp/anotto-web-review-typecheck.log`, `/tmp/anotto-web-review-lint.log`                                        |
| Final production build                              | Passed, exit 0 after review corrections                    | `/tmp/anotto-web-analysis-build-final.log`                                                                       |
| Independent web security review                     | Accepted; independently 5 suites / 66 tests passed         | `/tmp/anotto-audit-20261022.aFahmR/web-remediation-independent-tests.log`                                        |

The focused suite includes the existing 28 legacy email analysis tests and 7 reviewed form tests.
The full suite ran before the final review corrections; the post-review focused run covers every
affected area and preserves the existing manual-edit tests. The final review corrections make
ordinary open requests cache-preserving (`refresh: false`), thread explicit refresh to the
transport, reject cookie parse requests from a foreign Origin, and make category/destination rule
conditions exact with malformed regular expressions failing closed. A second complete run was
intentionally not requested by the release coordinator; do not describe 1510 as a full run of the
final corrected source. Mocked tests do not establish production queue execution or live external AI
behavior.

## Required release order

1. Complete independent SQL/Worker and web integration reviews and the full local suites. Keep
   existing personal and unrelated work out of the release.
2. Apply backend migration `20261022000010_inbox_analysis_jobs.sql`, including owner read grants for
   the explicitly selected job columns and the durable new-intake trigger. The web list depends on
   these tables/columns and must not precede the migration.
3. Release the new authenticated Worker analysis/dispatch routes and scheduled recovery path.
   Confirm the deployed contract before publishing the corresponding web client. This checklist
   itself performs none of those actions.
4. Configure the trusted server `WORKER_URL`. `WORKER_INBOX_ANALYSIS_ENABLED` defaults to true;
   false temporarily retains the legacy path only for email items without v3 analysis. It never
   sends non-email content through the forwarded-email scope.
5. Release the web after the backend is ready. Run authorized owner/wrong-owner, pending-to-ready,
   blocked-consent/quota, cached-open/manual-edit and explicit-refresh acceptance checks without
   financial posting. Record the release identifier and actual outcomes separately.
6. Only after that web release is accepted may the corresponding new mobile endpoint integration
   proceed. Existing mobile behavior and installed artifacts are outside this web task.

## Remaining runtime limits

Background analysis depends on the deployed durable jobs, Worker queue/scheduler, current consent,
source eligibility, quota and provider availability. Preparation is not a financial confirmation.
Production dispatch, live AI output, authenticated browser acceptance and the corresponding new
mobile integration remain unverified in this local implementation evidence.
