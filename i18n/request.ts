import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, isValidLocale } from './config';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('locale')?.value;
  const locale = isValidLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,
    messages: {
      ...(await import(`../messages/${locale}.json`)).default,
      wealth: (await import(`../messages/wealth.${locale === 'es' ? 'es' : 'en'}.json`)).default,
      emailForwarding: (
        await import(`../messages/email-forwarding.${locale === 'es' ? 'es' : 'en'}.json`)
      ).default,
    },
  };
});
