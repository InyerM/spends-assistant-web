import type { User } from '@supabase/supabase-js';

export const eligibilityVersion = '2026-10-06';

const enrollmentStart = Date.parse('2026-10-06T00:00:00Z');

export function needsEligibilityAttestation(user: User): boolean {
  const createdAt = Date.parse(user.created_at);
  if (Number.isNaN(createdAt) || createdAt < enrollmentStart) return false;

  const declaration = user.user_metadata.anotto_eligibility;
  return (
    declaration?.version !== eligibilityVersion ||
    declaration?.adult !== true ||
    declaration?.country !== 'CO'
  );
}
