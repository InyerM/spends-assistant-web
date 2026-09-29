import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthError, getAdminClient, getUserClient } from '@/lib/api/server';
import { hashApiKey } from '@/lib/utils/api-key';

export interface InboxClient {
  supabase: SupabaseClient;
  userId: string;
}

/** The Shortcut may use an existing per-user API key; browsers use their session cookie. */
export async function getShortcutPostClient(request: Request): Promise<InboxClient> {
  const authorization = request.headers.get('authorization');
  if (!authorization) return getUserClient();

  const match = /^Bearer (sk_[a-zA-Z0-9]+)$/u.exec(authorization);
  if (!match) throw new AuthError();

  const keyHash = await hashApiKey(match[1]);
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('user_api_keys')
    .select('user_id')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .maybeSingle();
  if (error || !data?.user_id) throw new AuthError();

  return { supabase: admin, userId: data.user_id as string };
}
