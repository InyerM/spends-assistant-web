'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AlertTriangle, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import { resolveSupportLinks } from '@/lib/utils/support-links';
import { useAppSettings } from '@/hooks/use-app-settings';
import { useProfile } from '@/hooks/use-profile';
import { useDeleteUserAccount } from '@/lib/api/mutations/account-deletion.mutations';
import { supabaseClient } from '@/lib/supabase/client';

export function DangerZoneSection(): React.ReactElement {
  const t = useTranslations('settings');
  const router = useRouter();
  const { data: appSettings } = useAppSettings();
  const { data: profile } = useProfile();
  const deletion = useDeleteUserAccount();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { supportEmail } = resolveSupportLinks(appSettings as Record<string, unknown> | undefined);

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
        <p className='text-muted-foreground text-sm leading-6'>
          {t('deletionRetention')}{' '}
          <a
            className='text-foreground underline underline-offset-4'
            href='https://anotto.app/privacy/#conservacion'
            target='_blank'
            rel='noopener noreferrer'>
            {t('deletionRetentionLink')}
          </a>
        </p>
        <div className='flex flex-wrap items-center gap-3'>
          <Button
            variant='destructive'
            className='min-h-11'
            disabled={!profile || deletion.isPending}
            onClick={(): void => setConfirmOpen(true)}>
            {t('deleteAccountButton')}
          </Button>
          {supportEmail && (
            <Button variant='outline' className='min-h-11' asChild>
              <a href={`mailto:${supportEmail}`}>
                <Mail className='mr-2 h-4 w-4' />
                {t('contactSupport')}
              </a>
            </Button>
          )}
        </div>
        <ConfirmDeleteDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={t('deleteAccountConfirmTitle')}
          description={t('deleteAccountConfirmDescription')}
          confirmText={profile?.email ?? 'DELETE'}
          confirmLabel={t('deleteAccountButton')}
          isPending={deletion.isPending}
          onConfirm={(): void => {
            deletion.mutate(profile?.email ?? 'DELETE', {
              onSuccess: () => {
                void supabaseClient.auth.signOut({ scope: 'local' }).finally(() => {
                  router.replace('/login');
                  router.refresh();
                });
              },
              onError: () => toast.error(t('deleteAccountFailed')),
            });
          }}
        />
      </CardContent>
    </Card>
  );
}
