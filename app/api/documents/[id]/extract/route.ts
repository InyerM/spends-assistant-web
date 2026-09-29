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
    if (document.status !== 'uploaded' && document.status !== 'failed') {
      return errorResponse('Document already extracted', 409);
    }
    if (!document.file_path.startsWith(`${userId}/`))
      return errorResponse('Invalid document path', 400);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return errorResponse('No authentication token available', 401);
    const { data: image, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.file_path);
    if (downloadError) return errorResponse('Failed to read document', 400);

    const bytes = Buffer.from(await image.arrayBuffer());
    const response = await fetch(`${workerConfig.url}/vision/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        image_data_url: `data:${document.mime_type};base64,${bytes.toString('base64')}`,
      }),
    });
    if (!response.ok) {
      await supabase
        .from('documents')
        .update({ status: 'failed', error_code: `WORKER_${response.status}` })
        .eq('id', id);
      return errorResponse('Image extraction failed', response.status);
    }
    const extraction = parseExtraction(await response.json());
    if (!extraction) {
      await supabase
        .from('documents')
        .update({ status: 'failed', error_code: 'INVALID_RESPONSE' })
        .eq('id', id);
      return errorResponse('Invalid extraction response', 502);
    }

    const observations = extraction.draft.observations.map((observation, ordinal) => ({
      document_id: id,
      user_id: userId,
      ordinal,
      amount: observation.amount,
      currency: observation.currency,
      occurred_at_text: observation.occurred_at,
      description: observation.description,
      counterparty: observation.counterparty,
      reference: observation.reference,
      source_excerpt: observation.source_excerpt,
      confidence: observation.confidence,
      status: 'pending',
    }));
    if (observations.length > 0) {
      const { error } = await supabase.from('document_observations').insert(observations);
      if (error) return errorResponse('Failed to save observations');
    }
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        status: 'extracted',
        document_type: extraction.draft.document_type,
        model: extraction.model,
        error_code: null,
      })
      .eq('id', id);
    if (updateError) return errorResponse('Failed to save extraction');
    return jsonResponse({
      document_id: id,
      document_type: extraction.draft.document_type,
      observations,
    });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Failed to extract document');
  }
}
