import { supabaseClient } from '@/lib/supabase/client';
import { eligibilityVersion } from '@/lib/auth/eligibility';

export async function confirmEligibility(): Promise<void> {
  const { error } = await supabaseClient.auth.updateUser({
    data: {
      anotto_eligibility: {
        adult: true,
        country: 'CO',
        version: eligibilityVersion,
      },
    },
  });
  if (error) throw error;
}
