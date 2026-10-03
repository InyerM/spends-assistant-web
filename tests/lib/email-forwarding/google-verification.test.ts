import { describe, expect, it } from 'vitest';
import { googleVerificationUrl } from '@/lib/email-forwarding/google-verification';

describe('googleVerificationUrl', () => {
  it('finds Gmail confirmation links in a received message', () => {
    expect(googleVerificationUrl('Confirm: https://mail-settings.google.com/mail/vf-example')).toBe(
      'https://mail-settings.google.com/mail/vf-example',
    );
  });

  it('ignores links that only resemble a Google address', () => {
    expect(
      googleVerificationUrl('https://mail-settings.google.com.evil.test/mail/vf-example'),
    ).toBeNull();
  });
});
