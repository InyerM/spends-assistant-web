import { useMutation } from '@tanstack/react-query';
import { TERMS_VERSION } from '@/lib/auth/legal-acceptance';
import { supabaseClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';

export async function acceptCurrentTerms(): Promise<void> {
  const response = await fetch('/api/legal/acceptance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accepted: true, version: TERMS_VERSION }),
  });
  if (!response.ok) throw new Error('Terms acceptance unavailable');
  const { data, error } = await supabaseClient.auth.refreshSession();
  if (error || !data.user) throw new Error('Session refresh required');
  useAuthStore.getState().setSupabaseUser(data.user);
}

export function useAcceptCurrentTerms(): ReturnType<typeof useMutation<void, Error, void>> {
  return useMutation({ mutationFn: acceptCurrentTerms, retry: false });
}
