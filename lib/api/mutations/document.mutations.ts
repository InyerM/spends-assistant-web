import type { StoredDocument } from '@/lib/api/queries/document.queries';
import { aiConsentErrorFromResponse } from '@/lib/ai-consent';

export class DocumentExtractionError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DocumentExtractionError';
  }
}

async function check(response: Response): Promise<Response> {
  if (response.ok) return response;
  const consentError = await aiConsentErrorFromResponse(response);
  if (consentError) throw consentError;
  const body = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
  if (body.code?.startsWith('PDF_'))
    throw new DocumentExtractionError(body.code, body.error ?? body.code);
  throw new Error(body.error ?? 'Document request failed');
}

export async function uploadDocument(file: File): Promise<StoredDocument> {
  const body = new FormData();
  body.set('file', file);
  return (
    await check(await fetch('/api/documents', { method: 'POST', body }))
  ).json() as Promise<StoredDocument>;
}

export async function extractDocument(id: string, password?: string): Promise<void> {
  await check(
    await fetch(`/api/documents/${id}/extract`, {
      method: 'POST',
      ...(password !== undefined
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }
        : {}),
    }),
  );
}

export async function setDocumentArchived(id: string, archived: boolean): Promise<void> {
  await check(
    await fetch(`/api/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived }),
    }),
  );
}

export async function restoreDocumentObservation(
  documentId: string,
  observationId: string,
): Promise<void> {
  await check(
    await fetch(`/api/documents/${documentId}/observations/${observationId}/restore`, {
      method: 'POST',
    }),
  );
}

export async function decideDocumentObservation(input: {
  documentId: string;
  observationId: string;
  action: 'accept' | 'reject_observation';
  transactionId?: string;
  key: string;
  reason?: string;
  reasonDetail?: string;
}): Promise<void> {
  await check(
    await fetch(`/api/documents/${input.documentId}/decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        observation_id: input.observationId,
        action: input.action,
        transaction_id: input.transactionId ?? null,
        idempotency_key: input.key,
        reason: input.reason,
        reason_detail: input.reasonDetail,
      }),
    }),
  );
}

export async function reviseDocumentObservation(
  documentId: string,
  observationId: string,
  body: {
    amount: number;
    currency: string | null;
    occurred_at_text: string;
    description: string;
  },
): Promise<void> {
  await check(
    await fetch(`/api/documents/${documentId}/observations/${observationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

export async function recoverDocumentTransaction(
  documentId: string,
  observationId: string,
): Promise<string | null> {
  const response = await check(
    await fetch(`/api/documents/${documentId}/observations/${observationId}`),
  );
  const result = (await response.json()) as { transaction_id: string | null };
  return result.transaction_id;
}

export async function suggestDocumentCategoryWithAi(text: string): Promise<string | null> {
  const response = await check(
    await fetch('/api/transactions/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }),
  );
  const result = (await response.json()) as {
    status?: string;
    resolved?: { category_id?: string };
  };
  return result.status === 'skipped' ? null : (result.resolved?.category_id ?? null);
}
