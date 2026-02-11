import type { NextRequest } from 'next/server';
import { getAdminClient, jsonResponse, errorResponse } from '@/lib/api/server';

export async function GET(): Promise<Response> {
  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('automation_rules')
      .select('*')
      .order('priority', { ascending: false });

    if (error) return errorResponse(error.message, 400);
    return jsonResponse(data);
  } catch {
    return errorResponse('Failed to fetch automation rules');
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const supabase = getAdminClient();
    const body = await request.json();

    const { data, error } = await supabase.from('automation_rules').insert(body).select().single();

    if (error) return errorResponse(error.message, 400);
    return jsonResponse(data, 201);
  } catch {
    return errorResponse('Failed to create automation rule');
  }
}
