import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { AiConsentScope } from '@/lib/ai-consent';

const requiredKey: Record<AiConsentScope, string> = {
  financial_text: 'requiredFinancialText',
  document_images: 'requiredDocumentImages',
  forwarded_email: 'requiredForwardedEmail',
};

export function AiConsentNotice({ scope }: { scope: AiConsentScope }): React.ReactElement {
  const t = useTranslations('aiConsent');
  return (
    <div
      role='alert'
      className='border-brand-secondary/30 bg-brand-secondary/5 space-y-1 rounded-lg border p-3 text-sm'>
      <p>{t(requiredKey[scope])}</p>
      <Link
        href='/settings?tab=ai-processing'
        className='text-brand font-medium underline underline-offset-2'>
        {t('reviewPermissions')}
      </Link>
    </div>
  );
}
