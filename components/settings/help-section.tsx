'use client';

import { useTranslations } from 'next-intl';
import { HelpCircle, ExternalLink, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAppSettings } from '@/hooks/use-app-settings';

export function HelpSection(): React.ReactElement {
  const t = useTranslations('settings');
  const { data: appSettings } = useAppSettings();

  const settings = appSettings as Record<string, unknown> | undefined;
  const faqUrl = settings?.faq_url as string | undefined;
  const supportEmail = settings?.support_email as string | undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <HelpCircle className='h-5 w-5' />
          {t('help')}
        </CardTitle>
        <CardDescription>{t('helpDescription')}</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-wrap gap-3'>
        {faqUrl && (
          <Button variant='outline' asChild>
            <a href={faqUrl} target='_blank' rel='noopener noreferrer'>
              <ExternalLink className='mr-2 h-4 w-4' />
              {t('faq')}
            </a>
          </Button>
        )}
        {supportEmail && (
          <Button variant='outline' asChild>
            <a href={`mailto:${supportEmail}`}>
              <Mail className='mr-2 h-4 w-4' />
              {t('supportEmail')}
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
