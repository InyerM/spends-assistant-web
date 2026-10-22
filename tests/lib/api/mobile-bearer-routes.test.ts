import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isMobileBearerRoute } from '@/lib/api/mobile-bearer-routes';

const id = '11111111-1111-4111-8111-111111111111';
const documentMethods = [
  [`/api/documents/${id}`, 'PATCH'],
  ['/api/documents/pending-count', 'GET'],
  [`/api/documents/${id}/inspect`, 'GET'],
  [`/api/documents/${id}/inspect`, 'POST'],
  [`/api/documents/${id}/reconciliation`, 'GET'],
  [`/api/documents/${id}/reconciliation`, 'POST'],
  [`/api/documents/${id}/reconciliation/create`, 'POST'],
  [`/api/documents/${id}/review-status`, 'POST'],
  [`/api/documents/${id}/suggestions`, 'GET'],
  [`/api/documents/${id}/decisions`, 'POST'],
  [`/api/documents/${id}/observations/${id}`, 'GET'],
  [`/api/documents/${id}/observations/${id}`, 'PATCH'],
  [`/api/documents/${id}/observations/${id}/analyze`, 'POST'],
  [`/api/documents/${id}/observations/${id}/restore`, 'POST'],
] as const;

describe('native route delegation boundaries', () => {
  it.each(documentMethods)('retains released document %s %s support', (pathname, method) => {
    expect(isMobileBearerRoute(pathname, method)).toBe(true);
  });

  it.each([
    ['/api/documents/not-a-uuid/inspect', 'GET'],
    [`/api/documents/${id}/observations/${id}/restore`, 'DELETE'],
    [`/api/documents/${id}/reconciliation/create/extra`, 'POST'],
    ['/api/documents/pending-count', 'POST'],
    ['/api/transactions', 'GET'],
    ['/api/__proto__', 'GET'],
    ['/api/settings/sessions', 'DELETE'],
    ['/api/email-forwarding', 'POST'],
    ['/api/fx/reference-rate', 'GET'],
    ['/api/fx-reference', 'POST'],
  ])('does not delegate an unapproved %s %s operation', (pathname, method) => {
    expect(isMobileBearerRoute(pathname, method)).toBe(false);
  });

  it.each([
    ['fx-reference', ['GET']],
    ['financial-chat/history', ['GET', 'DELETE']],
    ['contacts', ['GET', 'POST']],
    ['contacts/[id]', ['GET', 'PATCH']],
    ['accounts/[id]/activity', ['GET']],
    ['accounts/[id]/currencies', ['POST']],
    ['statements/proofs', ['GET']],
    ['transactions/category-review', ['GET']],
    ['transactions/[id]/analyze', ['POST']],
    ['transactions/[id]/category-review', ['POST']],
    ['transactions/[id]/category-followup', ['GET', 'POST']],
    ['transactions/[id]/category-followup/explain', ['POST']],
    ['transactions/[id]/category-followup/review', ['POST']],
    ['transactions/[id]/duplicate-review', ['POST']],
    ['transactions/[id]/funding-correction', ['POST']],
  ] as const)(
    'requires %s delegated methods to authenticate the actual Request',
    (path, methods) => {
      const source = readFileSync(resolve(`app/api/${path}/route.ts`), 'utf8');
      for (const method of methods) {
        const start = source.indexOf(`export async function ${method}(`);
        expect(start).toBeGreaterThanOrEqual(0);
        const nextMethod = source.indexOf('export async function ', start + 1);
        const handler = source.slice(start, nextMethod === -1 ? undefined : nextMethod);
        expect(handler).toContain('getUserClient(request)');
      }
    },
  );
});
