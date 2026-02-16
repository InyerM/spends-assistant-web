import type { NextRequest } from 'next/server';
import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';

export async function GET(): Promise<Response> {
  try {
    const { supabase } = await getUserClient();

    const { data, error } = await supabase
      .from('imports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return errorResponse(error.message, 400);
    return jsonResponse(data);
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
    const rowCount = parseInt(formData.get('row_count') as string, 10) || 0;
    const importedCount = parseInt(formData.get('imported_count') as string, 10) || 0;

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

    // Record in imports table
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
