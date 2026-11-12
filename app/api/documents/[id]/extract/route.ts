import { splitPdfForOcr, prepareImageForOcr, PdfOcrError } from '@/lib/pdf-ocr';
import { buildStatementMetadata } from '@/lib/statement-metadata';
import { readPdfText, PdfTextError } from '@/lib/pdf-text';
import type { NextRequest } from 'next/server';
import { AuthError, errorResponse, getAdminClient, getUserClient } from '@/lib/api/server';
import { workerConfig } from '@/lib/config';
import { parseExtraction, parseOcrExtraction } from '@/lib/documents';
import { forwardAiConsentError } from '@/lib/ai-consent';

export const maxDuration = 240;

const privateHeaders = { 'Cache-Control': 'private, no-store' };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { supabase, userId, accessToken } = await getUserClient(request);
    const body: unknown = await request.json().catch(() => null);
    const strategy =
      body && typeof body === 'object' && 'strategy' in body ? body.strategy : 'local_text';
    if (strategy !== 'local_text' && strategy !== 'mistral_ocr')
      return errorResponse('Invalid extraction strategy', 400);
    const cloudOcr = strategy === 'mistral_ocr';
    if (
      cloudOcr &&
      (process.env.DOCUMENT_PDF_OCR_ENABLED !== 'true' ||
        !process.env.DOCUMENT_PDF_OCR_PROXY_SECRET)
    )
      return errorResponse('Optional PDF OCR is unavailable', 503);
    const password =
      body && typeof body === 'object' && 'password' in body
        ? (body as { password: unknown }).password
        : undefined;
    if (password !== undefined && (typeof password !== 'string' || password.length > 128))
      return errorResponse('Invalid PDF password', 400);
    if (cloudOcr && password !== undefined)
      return errorResponse('OCR does not accept PDF passwords', 400);
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

    const sessionToken =
      accessToken ?? (await supabase.auth.getSession()).data.session?.access_token;
    if (!sessionToken) return errorResponse('No authentication token available', 401);

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
      await getAdminClient().rpc('fail_document_extraction_server', {
        p_document_id: id,
        p_owner_id: userId,
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
      const isPdf = document.mime_type === 'application/pdf';
      const prepared = cloudOcr
        ? isPdf
          ? await splitPdfForOcr(bytes)
          : await prepareImageForOcr(bytes, document.mime_type)
        : null;
      const pdf =
        isPdf && !cloudOcr
          ? await readPdfText(bytes, typeof password === 'string' ? password : undefined)
          : null;
      if (pdf) {
        const cache = await getAdminClient().rpc('cache_statement_metadata', {
          p_document_id: id,
          p_owner_id: userId,
          p_metadata: buildStatementMetadata(pdf.pages),
        });
        if (cache.error) throw new Error('Could not cache statement metadata');
      }
      const response = await fetch(
        `${workerConfig.url}${cloudOcr ? '/documents/extract-pdf-ocr' : isPdf ? '/documents/extract-text' : '/vision/extract'}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
            ...(cloudOcr
              ? { 'X-Document-OCR-Proxy-Secret': process.env.DOCUMENT_PDF_OCR_PROXY_SECRET! }
              : {}),
          },
          signal: AbortSignal.timeout(isPdf ? 210_000 : 90_000),
          body: JSON.stringify(
            prepared
              ? { documentId: id, claimToken, ...prepared }
              : pdf
                ? { pages: pdf.pages }
                : {
                    image_data_url: `data:${document.mime_type};base64,${bytes.toString('base64')}`,
                  },
          ),
        },
      );
      if (!response.ok) {
        const consentError = await forwardAiConsentError(response);
        if (consentError) {
          await markFailed('AI_CONSENT_REQUIRED');
          return consentError;
        }
        if (cloudOcr) {
          const failure = (await response.json().catch(() => null)) as { code?: unknown } | null;
          const allowed = [
            'CLOUD_PDF_DISABLED',
            'CLOUD_PDF_BUDGET_EXCEEDED',
            'CLOUD_PDF_CLAIM_UNAVAILABLE',
            'CLOUD_PDF_INVALID_INPUT',
            'PARSE_LIMIT_REACHED',
          ];
          const code =
            typeof failure?.code === 'string' && allowed.includes(failure.code)
              ? failure.code
              : 'CLOUD_PDF_REQUEST_FAILED';
          await markFailed(code);
          return Response.json(
            { code, error: 'Optional PDF OCR failed' },
            { status: response.status, headers: privateHeaders },
          );
        }
        await markFailed(`WORKER_${response.status}`);
        return errorResponse(
          isPdf ? 'Statement extraction failed' : 'Image extraction failed',
          response.status,
        );
      }
      const rawExtraction: unknown = await response.json().catch(() => null);
      const extraction = parseExtraction(rawExtraction);
      const ocrResult = cloudOcr ? parseOcrExtraction(rawExtraction, prepared!.pages.length) : null;
      if (cloudOcr && !ocrResult) {
        await markFailed('INVALID_RESPONSE');
        return errorResponse('Invalid OCR page completion', 502);
      }
      if (!extraction) {
        await markFailed('INVALID_RESPONSE');
        return errorResponse('Invalid extraction response', 502);
      }

      const observations = extraction.draft.observations.map((observation, ordinal) => ({
        ordinal,
        ...(ocrResult ? { source_page: ocrResult.draft.observations[ordinal].source_page } : {}),
        amount: observation.amount,
        currency: observation.currency,
        occurred_at_text: observation.occurred_at,
        description: observation.description,
        counterparty: observation.counterparty,
        reference: observation.reference,
        source_excerpt: observation.source_excerpt,
        confidence: observation.confidence,
      }));
      const { error: completionError } = await getAdminClient().rpc(
        'complete_document_extraction_server',
        {
          p_document_id: id,
          p_owner_id: userId,
          p_claim_token: claimToken,
          p_document_type: extraction.draft.document_type,
          p_model: extraction.model,
          p_observations: observations,
          ...(prepared
            ? {
                p_page_count: prepared.pages.length,
                p_source_sha256: prepared.sourceSha256,
                p_pathway: 'cloud-pdf-mistral-ocr',
              }
            : {}),
        },
      );
      if (completionError) {
        await markFailed('PERSISTENCE_FAILED');
        return errorResponse('Failed to save extraction');
      }
      return Response.json(
        { document_id: id, document_type: extraction.draft.document_type, observations },
        { headers: privateHeaders },
      );
    } catch (error) {
      if (error instanceof PdfTextError || error instanceof PdfOcrError) {
        await markFailed(error.code);
        return Response.json(
          { code: error.code, error: 'PDF could not be read' },
          { status: 422, headers: privateHeaders },
        );
      }
      await markFailed('EXTRACTION_FAILED');
      return errorResponse('Failed to extract document');
    }
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse(
          error.status === 403 ? 'Invalid request origin' : 'Unauthorized',
          error.status === 403 ? 403 : 401,
        )
      : errorResponse('Failed to extract document');
  }
}
