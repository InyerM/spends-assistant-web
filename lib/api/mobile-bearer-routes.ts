// These exact methods already authenticate the Request with getUserClient(request).
// The proxy delegates authentication to them; no token, owner, origin or review check is skipped.
const MOBILE_BEARER_ROUTES: Record<string, readonly string[]> = {
  '/api/purchase-locations': ['GET'],
  '/api/planning': ['GET', 'POST'],
  '/api/api-keys': ['GET', 'POST', 'DELETE'],
  '/api/settings/sessions': ['GET'],
  '/api/settings/user-settings': ['GET', 'PATCH'],
  '/api/settings/account/delete': ['POST'],
  '/api/merchant-suggestions': ['POST'],
  '/api/financial-chat/history': ['GET', 'DELETE'],
  '/api/contacts': ['GET', 'POST'],
  '/api/statements/proofs': ['GET'],
  '/api/fx-reference': ['GET'],
  '/api/transactions': ['POST'],
  '/api/transactions/category-review': ['GET'],
  '/api/documents': ['GET', 'POST'],
  '/api/documents/pending-count': ['GET'],
  // This existing intake handler separately validates per-user Shortcut API keys.
  '/api/shortcut-inbox': ['POST'],
};
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const DYNAMIC_ROUTES: ReadonlyArray<readonly [RegExp, readonly string[]]> = [
  [new RegExp(`^/api/contacts/${UUID}$`, 'iu'), ['GET', 'PATCH']],
  [new RegExp(`^/api/accounts/${UUID}/activity$`, 'iu'), ['GET']],
  [new RegExp(`^/api/accounts/${UUID}/currencies$`, 'iu'), ['POST']],
  [new RegExp(`^/api/shortcut-inbox/${UUID}/analyze$`, 'iu'), ['POST']],
  [new RegExp(`^/api/transactions/${UUID}/category-followup$`, 'iu'), ['GET', 'POST']],
  [
    new RegExp(
      `^/api/transactions/${UUID}/(?:analyze|category-review|duplicate-review|funding-correction|category-followup/(?:explain|review))$`,
      'iu',
    ),
    ['POST'],
  ],
  [new RegExp(`^/api/documents/${UUID}$`, 'iu'), ['PATCH']],
  [new RegExp(`^/api/documents/${UUID}/(?:inspect|reconciliation)$`, 'iu'), ['GET', 'POST']],
  [new RegExp(`^/api/documents/${UUID}/suggestions$`, 'iu'), ['GET']],
  [
    new RegExp(
      `^/api/documents/${UUID}/(?:extract|decisions|review-status|reconciliation/create)$`,
      'iu',
    ),
    ['POST'],
  ],
  [new RegExp(`^/api/documents/${UUID}/observations/${UUID}$`, 'iu'), ['GET', 'PATCH']],
  [new RegExp(`^/api/documents/${UUID}/observations/${UUID}/(?:analyze|restore)$`, 'iu'), ['POST']],
];

export function isMobileBearerRoute(pathname: string, method: string): boolean {
  return (
    (Object.hasOwn(MOBILE_BEARER_ROUTES, pathname) &&
      MOBILE_BEARER_ROUTES[pathname].includes(method)) ||
    DYNAMIC_ROUTES.some(([path, methods]) => methods.includes(method) && path.test(pathname))
  );
}
