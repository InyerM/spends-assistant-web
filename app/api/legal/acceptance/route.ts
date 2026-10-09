import { createClient } from '@/lib/supabase/server';
import { TERMS_VERSION } from '@/lib/auth/legal-acceptance';

export async function POST(request: Request): Promise<Response> {
  if (request.headers.get('Origin') !== new URL(request.url).origin) {
    return Response.json({ error: 'Invalid request origin' }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    accepted?: unknown;
    version?: unknown;
  } | null;
  if (body?.accepted !== true || body.version !== TERMS_VERSION) {
    return Response.json({ error: 'Explicit current terms acceptance required' }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { error } = await supabase.rpc('accept_current_terms', { p_version: TERMS_VERSION });
  if (error) return Response.json({ error: 'Terms acceptance unavailable' }, { status: 503 });
  return Response.json(
    { accepted: true, version: TERMS_VERSION },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
