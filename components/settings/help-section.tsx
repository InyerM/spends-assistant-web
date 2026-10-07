'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronDown, ExternalLink, FileText, LifeBuoy, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HELP_TOPICS } from '@/lib/constants/help-center';
import { useAppSettings } from '@/hooks/use-app-settings';

export function HelpSection(): React.ReactElement {
  const t = useTranslations('helpCenter');
  const { data: appSettings } = useAppSettings();

  const settings = appSettings as Record<string, unknown> | undefined;
  const faqUrl = settings?.faq_url as string | undefined;
  const supportEmail = settings?.support_email as string | undefined;

  return (
    <div className='space-y-5'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <LifeBuoy className='text-brand h-5 w-5' />
            {t('faqTitle')}
          </CardTitle>
          <CardDescription>{t('faqDescription')}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-2'>
          {HELP_TOPICS.map(({ key, href }) => (
            <details key={key} className='group border-border bg-card-overlay/30 rounded-xl border'>
              <summary className='focus-visible:ring-ring/50 flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-4 py-4 text-sm font-medium outline-none focus-visible:ring-[3px] [&::-webkit-details-marker]:hidden'>
                {t(`${key}.question`)}
                <ChevronDown className='text-muted-foreground h-4 w-4 shrink-0 transition-transform group-open:rotate-180' />
              </summary>
              <div className='border-border space-y-3 border-t px-4 py-4'>
                <p className='text-muted-foreground text-sm leading-6'>{t(`${key}.answer`)}</p>
                <Button variant='outline' size='sm' asChild>
                  <Link href={href}>{t(`${key}.link`)}</Link>
                </Button>
              </div>
            </details>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <FileText className='text-brand h-5 w-5' />
            {t('legalTitle')}
          </CardTitle>
          <CardDescription>{t('legalDescription')}</CardDescription>
        </CardHeader>
        <CardContent className='flex flex-wrap gap-3'>
          <Button variant='outline' size='sm' asChild>
            <a href='https://anotto.app/privacy/' target='_blank' rel='noopener noreferrer'>
              {t('privacyAction')}
              <ExternalLink className='h-4 w-4' />
            </a>
          </Button>
          <Button variant='outline' size='sm' asChild>
            <a href='https://anotto.app/terms/' target='_blank' rel='noopener noreferrer'>
              {t('termsAction')}
              <ExternalLink className='h-4 w-4' />
            </a>
          </Button>
        </CardContent>
      </Card>

      {(supportEmail || faqUrl) && (
        <Card>
          <CardHeader>
            <CardTitle>{t('contactTitle')}</CardTitle>
            <CardDescription>{t('contactDescription')}</CardDescription>
          </CardHeader>
          <CardContent className='flex flex-wrap gap-3'>
            {supportEmail && (
              <Button variant='outline' asChild>
                <a href={`mailto:${supportEmail}`}>
                  <Mail className='h-4 w-4' />
                  {t('contactAction')}
                </a>
              </Button>
            )}
            {faqUrl && (
              <Button variant='outline' asChild>
                <a href={faqUrl} target='_blank' rel='noopener noreferrer'>
                  <ExternalLink className='h-4 w-4' />
                  {t('externalFaq')}
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
