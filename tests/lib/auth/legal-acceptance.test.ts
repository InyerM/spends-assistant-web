import { expect, it } from 'vitest';
import { needsTermsAcceptance } from '@/lib/auth/legal-acceptance';
it('uses protected application metadata, preserving existing accounts', () => {
  expect(needsTermsAcceptance({ app_metadata: {} })).toBe(false);
  expect(needsTermsAcceptance({ app_metadata: { anotto_terms_required: true } })).toBe(true);
  expect(
    needsTermsAcceptance({
      app_metadata: { anotto_terms_required: true, anotto_terms_version: '2026-10-08' },
    }),
  ).toBe(false);
  expect(
    needsTermsAcceptance({
      app_metadata: { anotto_terms_required: true, anotto_terms_version: 'old' },
    }),
  ).toBe(true);
});
