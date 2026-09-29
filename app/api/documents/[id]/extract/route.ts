import type { NextRequest } from 'next/server';
import { AuthError, errorResponse, getUserClient, jsonResponse } from '@/lib/api/server';
import { workerConfig } from '@/lib/config';
import { parseExtraction } from '@/lib/documents';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    if (!workerConfig.url) return errorResponse('Worker not configured', 503);
    const { id } = await params;
    const { data: rawDocument } = await supabase
      .from('documents')
      .select('id, file_path, mime_type, status')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    const document = rawDocument as { file_path: string; mime_type: string; status: string } | null;
    if (!document) return errorResponse('Document not found', 404);
    if (document.status === 'extracted') {
      return errorResponse('Document already extracted', 409);
    }
    if (!document.file_path.startsWith(`${userId}/`))
      return errorResponse('Invalid document path', 400);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return errorResponse('No authentication token available', 401);

    const { data: claimToken, error: claimError } = await supabase.rpc(
      'claim_document_extraction',
      {
        p_document_id: id,
      },
    );
    if (claimError) return errorResponse('Failed to claim document extraction');
    if (!claimToken) return errorResponse('Document extraction already in progress', 409);
    if (typeof claimToken !== 'string') return errorResponse('Invalid extraction claim', 502);

    const markFailed = async (code: string): Promise<void> => {
      await supabase.rpc('fail_document_extraction', {
        p_document_id: id,
        p_claim_token: claimToken,
        p_error_code: code,
      });
    };

    try {
      const { data: image, error: downloadError } = await supabase.storage
        .from('documents')
        .download(document.file_path);
      if (downloadError) {
        await markFailed('DOWNLOAD_FAILED');
        return errorResponse('Failed to read document', 400);
      }

      const bytes = Buffer.from(await image.arrayBuffer());
      const response = await fetch(`${workerConfig.url}/vision/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        signal: AbortSignal.timeout(90_000),
        body: JSON.stringify({
          image_data_url: `data:${document.mime_type};base64,${bytes.toString('base64')}`,
        }),
      });
      if (!response.ok) {
        await markFailed(`WORKER_${response.status}`);
        return errorResponse('Image extraction failed', response.status);
      }
      const extraction = parseExtraction(await response.json().catch(() => null));
      if (!extraction) {
        await markFailed('INVALID_RESPONSE');
        return errorResponse('Invalid extraction response', 502);
      }

      const observations = extraction.draft.observations.map((observation, ordinal) => ({
        ordinal,
        amount: observation.amount,
        currency: observation.currency,
        occurred_at_text: observation.occurred_at,
        description: observation.description,
        counterparty: observation.counterparty,
        reference: observation.reference,
        source_excerpt: observation.source_excerpt,
        confidence: observation.confidence,
      }));
      const { error: completionError } = await supabase.rpc('complete_document_extraction', {
        p_document_id: id,
        p_claim_token: claimToken,
        p_document_type: extraction.draft.document_type,
        p_model: extraction.model,
        p_observations: observations,
      });
      if (completionError) {
        await markFailed('PERSISTENCE_FAILED');
        return errorResponse('Failed to save extraction');
      }
      return jsonResponse({
        document_id: id,
        document_type: extraction.draft.document_type,
        observations,
      });
    } catch {
      await markFailed('EXTRACTION_FAILED');
      return errorResponse('Failed to extract document');
    }
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Failed to extract document');
  }
}
