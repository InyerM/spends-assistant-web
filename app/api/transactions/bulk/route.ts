import type { NextRequest } from 'next/server';
import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';

const SAFE_FIELDS = new Set(['category_id', 'description', 'notes']);

export async function PATCH(request: NextRequest): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const body = (await request.json()) as {
      ids?: unknown;
      updates?: unknown;
    };

    if (
      !Array.isArray(body.ids) ||
      body.ids.length === 0 ||
      body.ids.length > 100 ||
      !body.ids.every((id: unknown) => typeof id === 'string' && id.length > 0) ||
      !body.updates ||
      typeof body.updates !== 'object' ||
      Array.isArray(body.updates) ||
      Object.keys(body.updates).length === 0
    ) {
      return errorResponse('ids and updates are required', 400);
    }
    const ids = [...new Set(body.ids as string[])];
    const updates = body.updates as Record<string, unknown>;
    if (Object.keys(updates).some((field) => !SAFE_FIELDS.has(field))) {
      return errorResponse('Bulk editing supports category, description, and notes only', 400);
    }
    if (
      (updates.category_id !== undefined &&
        updates.category_id !== null &&
        typeof updates.category_id !== 'string') ||
      (updates.description !== undefined &&
        (typeof updates.description !== 'string' || !updates.description.trim())) ||
      (updates.notes !== undefined && updates.notes !== null && typeof updates.notes !== 'string')
    ) {
      return errorResponse('Invalid bulk update value', 400);
    }
    let categoryType: string | null = null;
    if (typeof updates.category_id === 'string') {
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .select('id, type')
        .eq('id', updates.category_id)
        .eq('user_id', userId)
        .maybeSingle();
      if (categoryError || !category) return errorResponse('Category not found', 400);
      categoryType = category.type;
      const { data: targets, error: targetsError } = await supabase
        .from('transactions')
        .select('id, type')
        .eq('user_id', userId)
        .in('id', ids)
        .is('deleted_at', null);
      if (targetsError) return errorResponse(targetsError.message, 400);
      if (targets.length !== ids.length || targets.some((target) => target.type !== categoryType)) {
        return errorResponse('Category type must match every selected transaction', 400);
      }
    }

    let query = supabase
      .from('transactions')
      .update(updates)
      .eq('user_id', userId)
      .in('id', ids)
      .is('deleted_at', null);
    if (categoryType) query = query.eq('type', categoryType);
    const { data, error } = await query.select();

    if (error) return errorResponse(error.message, 400);
    return jsonResponse(data);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to bulk update transactions');
  }
}
