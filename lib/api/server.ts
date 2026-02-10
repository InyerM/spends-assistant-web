import { createAdminClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export function getAdminClient(): SupabaseClient {
  return createAdminClient();
}

export function jsonResponse(data: unknown, status: number = 200): Response {
  return Response.json(data, { status });
}

export function errorResponse(message: string, status: number = 500): Response {
  return Response.json({ error: message }, { status });
}
