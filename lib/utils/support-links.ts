const DEFAULT_SUPPORT_EMAIL = 'support@anotto.app';
const DEFAULT_FAQ_URL = 'https://anotto.app/#faq';

/** Discard obsolete seed values and unsafe settings before rendering public links. */
export function resolveSupportLinks(settings?: Record<string, unknown>): {
  supportEmail: string;
  faqUrl: string;
} {
  const email = typeof settings?.support_email === 'string' ? settings.support_email.trim() : '';
  const supportEmail =
    /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(email) &&
    !email.toLowerCase().endsWith('@spendsapp.com')
      ? email
      : DEFAULT_SUPPORT_EMAIL;
  let faqUrl = DEFAULT_FAQ_URL;
  if (typeof settings?.faq_url === 'string') {
    try {
      const url = new URL(settings.faq_url);
      if (
        url.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        url.hostname !== 'spendsapp.com' &&
        !url.hostname.endsWith('.spendsapp.com')
      ) {
        faqUrl = url.toString();
      }
    } catch {
      /* Use the published help section for invalid settings. */
    }
  }
  return { supportEmail, faqUrl };
}
