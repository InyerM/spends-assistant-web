import { describe, expect, it } from 'vitest';
import { resolveSupportLinks } from '@/lib/utils/support-links';

describe('support links', () => {
  it('uses the verified public Anotto destinations by default', () => {
    expect(resolveSupportLinks()).toEqual({
      supportEmail: 'support@anotto.app',
      faqUrl: 'https://anotto.app/#faq',
    });
  });
  it.each([
    'javascript:alert(1)',
    'http://example.com',
    'https://user:pass@example.com',
    'not a url',
  ])('rejects unsafe FAQ setting %s', (faq_url) => {
    expect(resolveSupportLinks({ faq_url }).faqUrl).toBe('https://anotto.app/#faq');
  });
  it('rejects mail header injection', () => {
    expect(
      resolveSupportLinks({ support_email: 'a@example.com\r\nBcc:other@example.com' }).supportEmail,
    ).toBe('support@anotto.app');
  });
});
