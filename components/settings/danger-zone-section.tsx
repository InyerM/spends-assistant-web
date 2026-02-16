'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAppSettings } from '@/hooks/use-app-settings';

export function DangerZoneSection(): React.ReactElement {
  const t = useTranslations('settings');
  const { data: appSettings } = useAppSettings();

  const settings = appSettings as Record<string, unknown> | undefined;
  const supportEmail = settings?.support_email as string | undefined;

  return (
    <Card className='border-destructive/50'>
      <CardHeader>
        <CardTitle className='text-destructive flex items-center gap-2'>
          <AlertTriangle className='h-5 w-5' />
          {t('dangerZone')}
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div>
          <p className='text-sm font-medium'>{t('deleteAccount')}</p>
          <p className='text-muted-foreground text-sm'>{t('deleteAccountDescription')}</p>
        </div>
        {supportEmail && (
          <Button variant='destructive' asChild>
            <a href={`mailto:${supportEmail}`}>
              <Mail className='mr-2 h-4 w-4' />
              {t('contactSupport')}
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
