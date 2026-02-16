import type { NextRequest } from 'next/server';
import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<Response> {
  try {
    const { id } = await params;
    const { supabase } = await getUserClient();
    const includeCounts = request.nextUrl.searchParams.get('include_counts') === 'true';

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) return errorResponse(error.message, 404);

    if (includeCounts) {
      const { count: transactionCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', id);

      const { count: childrenCount } = await supabase
        .from('categories')
        .select('*', { count: 'exact', head: true })
        .eq('parent_id', id)
        .is('deleted_at', null);

      return jsonResponse({
        ...data,
        transaction_count: transactionCount ?? 0,
        children_count: childrenCount ?? 0,
      });
    }

    return jsonResponse(data);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to fetch category');
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<Response> {
  try {
    const { id } = await params;
    const { supabase } = await getUserClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('categories')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) return errorResponse(error.message, 400);
    return jsonResponse(data);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to update category');
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams): Promise<Response> {
  try {
    const { id } = await params;
    const { supabase } = await getUserClient();

    // Check if the category is a default category
    const { data: category } = await supabase
      .from('categories')
      .select('is_default')
      .eq('id', id)
      .single();

    if (category?.is_default) {
      return errorResponse('Default categories cannot be deleted', 403);
    }

    const now = new Date().toISOString();

    // Count and unlink transactions from this category
    const { count: unlinkedCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', id);

    await supabase.from('transactions').update({ category_id: null }).eq('category_id', id);

    // Find and soft-delete children + unlink their transactions
    const { data: children } = await supabase
      .from('categories')
      .select('id')
      .eq('parent_id', id)
      .is('deleted_at', null);

    let childUnlinked = 0;
    if (children && children.length > 0) {
      const childIds = children.map((c) => c.id as string);

      const { count } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .in('category_id', childIds);
      childUnlinked = count ?? 0;

      await supabase.from('transactions').update({ category_id: null }).in('category_id', childIds);
      await supabase.from('categories').update({ deleted_at: now }).in('id', childIds);
    }

    // Soft-delete the category itself
    const { error } = await supabase.from('categories').update({ deleted_at: now }).eq('id', id);

    if (error) return errorResponse(error.message, 400);

    return jsonResponse({
      success: true,
      unlinked_transactions: (unlinkedCount ?? 0) + childUnlinked,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to delete category');
  }
}
