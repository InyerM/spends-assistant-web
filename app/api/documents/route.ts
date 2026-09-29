import type { NextRequest } from 'next/server';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
import { validateDocumentImage } from '@/lib/documents';

const privateHeaders = { 'Cache-Control': 'private, no-store' };

export async function GET(): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const { data, error } = await supabase
      .from('documents')
      .select('*, document_observations(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) return errorResponse(error.message, 400);
    return Response.json({ data }, { headers: privateHeaders });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Failed to list documents');
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') return errorResponse('Image is required', 400);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const invalid = validateDocumentImage(file.name, file.type, bytes);
    if (invalid) return errorResponse(invalid, 400);

    const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[file.type];
    const filePath = `${userId}/${crypto.randomUUID()}.${extension}`;
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = Array.from(new Uint8Array(digest), (value) =>
      value.toString(16).padStart(2, '0'),
    ).join('');
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, bytes, {
        contentType: file.type,
        upsert: false,
      });
    if (uploadError) return errorResponse(uploadError.message, 400);

    const { data, error } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        file_name: file.name,
        file_path: filePath,
        mime_type: file.type,
        sha256,
        status: 'uploaded',
      })
      .select()
      .single();
    if (error) {
      await supabase.storage.from('documents').remove([filePath]);
      return errorResponse(error.message, 400);
    }
    return Response.json(data, { status: 201, headers: privateHeaders });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Failed to upload document');
  }
}
