import type { User } from '@supabase/supabase-js';

export const TERMS_VERSION = '2026-10-08';
export const TERMS_URL = 'https://anotto.app/terms/';
export const PRIVACY_URL = 'https://anotto.app/privacy/';

export function needsTermsAcceptance(user: { app_metadata?: User['app_metadata'] }): boolean {
  return (
    user.app_metadata?.anotto_terms_required === true &&
    user.app_metadata.anotto_terms_version !== TERMS_VERSION
  );
}
