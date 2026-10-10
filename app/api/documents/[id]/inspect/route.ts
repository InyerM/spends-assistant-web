import { z } from 'zod';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
import { PdfTextError, readPdfText } from '@/lib/pdf-text';
import { detectStatementHints, type HintAccount } from '@/lib/statement-hints';
const headers = { 'Cache-Control': 'private, no-store' };
interface Context {
  params: Promise<{ id: string }>;
}
export async function POST(request: Request, { params }: Context): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient(request);
    const { id } = await params;
    const text = await request.text();
    if (text.length > 1024) return errorResponse('Inspection request too large', 413);
    const body = z
      .object({ password: z.string().max(128).optional() })
      .strict()
      .safeParse(JSON.parse(text) as unknown);
    if (!z.uuid().safeParse(id).success || !body.success)
      return errorResponse('Invalid PDF inspection request', 400);
    const document = await supabase
      .from('documents')
      .select('file_path,mime_type,document_type')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    const stored = document.data as {
      file_path: string;
      mime_type: string;
      document_type: string;
    } | null;
    if (document.error) throw new Error('Document unavailable');
    if (
      !stored ||
      stored.mime_type !== 'application/pdf' ||
      stored.document_type !== 'statement' ||
      !stored.file_path.startsWith(`${userId}/`)
    )
      return errorResponse('Statement not found', 404);
    const [file, accounts] = await Promise.all([
      supabase.storage.from('documents').download(stored.file_path),
      supabase
        .from('accounts')
        .select('id,is_active,last_four,bank_account_last_four,identifiers')
        .eq('user_id', userId)
        .is('deleted_at', null),
    ]);
    if (file.error || accounts.error) throw new Error('Inspection unavailable');
    const pdf = await readPdfText(
      new Uint8Array(await file.data.arrayBuffer()),
      body.data.password,
    );
    return Response.json(
      { hints: detectStatementHints(pdf.pages.join('\n'), accounts.data as HintAccount[]) },
      { headers },
    );
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    if (error instanceof PdfTextError)
      return Response.json({ code: error.code }, { status: 422, headers });
    return errorResponse('Could not inspect statement', 500);
  }
}
export async function GET(request: Request, { params }: Context): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient(request);
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return errorResponse('Invalid statement ID', 400);
    const doc = await supabase
      .from('documents')
      .select('file_path,mime_type')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    const stored = doc.data as { file_path: string; mime_type: string } | null;
    if (
      doc.error ||
      !stored ||
      stored.mime_type !== 'application/pdf' ||
      !stored.file_path.startsWith(`${userId}/`)
    )
      return errorResponse('PDF not found', 404);
    const result = await supabase.storage.from('documents').createSignedUrl(stored.file_path, 300);
    return result.error
      ? errorResponse('PDF unavailable')
      : Response.json({ url: result.data.signedUrl }, { headers });
  } catch (error) {
    return errorResponse(
      error instanceof AuthError ? 'Unauthorized' : 'PDF unavailable',
      error instanceof AuthError ? 401 : 500,
    );
  }
}
