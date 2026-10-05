'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useEmailForwardingRoute } from '@/lib/api/queries/email-forwarding.queries';
import ShortcutInboxPage from '../transactions/shortcut-inbox/page';

export default function EmailInboxPage(): React.ReactElement {
  const t = useTranslations('shortcutInbox');
  const { data: route, isLoading } = useEmailForwardingRoute();
  if (isLoading) return <p className='text-muted-foreground p-6 text-sm'>{t('loading')}</p>;
  if (route?.status !== 'active' || !route.user_confirmed_at) {
    return (
      <Card className='mx-auto mt-8 max-w-lg'>
        <CardContent className='space-y-4 p-6'>
          <h1 className='text-xl font-semibold'>{t('emailTitle')}</h1>
          <p className='text-muted-foreground text-sm'>{t('verificationRequired')}</p>
          <Button asChild variant='outline'>
            <Link href='/settings?tab=email-forwarding'>{t('openForwardingSettings')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  return <ShortcutInboxPage source='forwarded_email' />;
}
