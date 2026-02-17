import type { NextRequest } from 'next/server';
import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { supabase } = await getUserClient();
    const { searchParams } = request.nextUrl;

    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = parseInt(searchParams.get('limit') ?? '20', 10);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from('imports')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) return errorResponse(error.message, 400);
    return jsonResponse({ data, count });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to fetch imports');
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const importId = formData.get('import_id') as string | null;

    if (!file) {
      return errorResponse('No file provided', 400);
    }

    const fileName = file.name;
    const filePath = `${userId}/${Date.now()}-${fileName}`;

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage.from('imports').upload(filePath, file, {
      contentType: 'text/csv',
      upsert: false,
    });

    if (uploadError) {
      return errorResponse(uploadError.message, 400);
    }

    // Update existing import record with file_path if import_id provided
    if (importId) {
      await supabase.from('imports').update({ file_path: filePath }).eq('id', importId);
      return jsonResponse({ file_path: filePath }, 200);
    }

    // Fallback: create a new import record (legacy support)
    const rowCount = parseInt(formData.get('row_count') as string, 10) || 0;
    const importedCount = parseInt(formData.get('imported_count') as string, 10) || 0;

    const { data, error } = await supabase
      .from('imports')
      .insert({
        user_id: userId,
        source: 'csv',
        file_name: fileName,
        file_path: filePath,
        row_count: rowCount,
        imported_count: importedCount,
        status: 'completed',
      })
      .select()
      .single();

    if (error) return errorResponse(error.message, 400);
    return jsonResponse(data, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to record import');
  }
}
