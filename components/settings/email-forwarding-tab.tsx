'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy, Mail, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useEmailForwardingRoute } from '@/lib/api/queries/email-forwarding.queries';
import {
  useAcknowledgeEmailForwardingVerification,
  useCreateEmailForwardingRoute,
  useDeleteEmailForwardingRoute,
} from '@/lib/api/mutations/email-forwarding.mutations';
import { EmailForwardingSteps } from '@/components/settings/email-forwarding-steps';

export function EmailForwardingTab(): React.ReactElement {
  const t = useTranslations('emailForwarding');
  const { data: route, isLoading, isError, refetch, isFetching } = useEmailForwardingRoute();
  const createRoute = useCreateEmailForwardingRoute();
  const acknowledgeVerification = useAcknowledgeEmailForwardingVerification();
  const deleteRoute = useDeleteEmailForwardingRoute();
  const [copied, setCopied] = useState<'address' | 'confirmation' | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);

  async function copy(value: string, kind: 'address' | 'confirmation'): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
    } catch {
      setCopied(null);
    }
  }

  return (
    <Card>
      <CardHeader className='space-y-2'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <CardTitle className='flex items-center gap-2 text-lg'>
            <Mail className='text-primary size-5' aria-hidden='true' />
            {t('title')}
          </CardTitle>
          {route?.status === 'active' && (
            <Badge variant={route.user_confirmed_at ? 'default' : 'secondary'}>
              {route.user_confirmed_at && <Check aria-hidden='true' />}
              {route.user_confirmed_at
                ? t('verifiedByUser')
                : route.confirmation_received_at
                  ? t('verifyInGmail')
                  : t('awaitingConfirmation')}
            </Badge>
          )}
        </div>
        <CardDescription className='max-w-prose leading-relaxed'>
          {t('description')}
        </CardDescription>
      </CardHeader>

      <CardContent className='space-y-6'>
        {isLoading && (
          <p className='text-muted-foreground text-sm' role='status'>
            {t('loading')}
          </p>
        )}
        {isError && (
          <div className='space-y-3' role='alert'>
            <p className='text-destructive text-sm'>{t('loadError')}</p>
            <Button variant='outline' size='sm' onClick={() => void refetch()}>
              {t('retry')}
            </Button>
          </div>
        )}

        {route?.status === 'unavailable' && (
          <p className='text-muted-foreground text-sm leading-relaxed' role='status'>
            {t('setupUnavailable')}
          </p>
        )}

        {route?.status === 'unconfigured' && (
          <div className='space-y-4'>
            <p className='text-foreground text-sm leading-relaxed'>{t('intro')}</p>
            <Button onClick={() => createRoute.mutate()} disabled={createRoute.isPending}>
              {createRoute.isPending ? t('creatingAddress') : t('createAddress')}
            </Button>
            {createRoute.isError && (
              <p className='text-destructive text-sm' role='alert'>
                {t('createError')}
              </p>
            )}
          </div>
        )}

        {route?.status === 'active' && (
          <>
            <div className='bg-muted/70 space-y-2 rounded-lg p-4'>
              <p className='text-muted-foreground text-xs font-medium'>{t('yourAddress')}</p>
              <div className='flex flex-wrap items-center gap-3'>
                <span className='min-w-0 flex-1 font-medium break-all select-all'>
                  {route.address}
                </span>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => void copy(route.address, 'address')}>
                  {copied === 'address' ? (
                    <Check aria-hidden='true' />
                  ) : (
                    <Copy aria-hidden='true' />
                  )}
                  {copied === 'address' ? t('copied') : t('copyAddress')}
                </Button>
              </div>
            </div>

            <EmailForwardingSteps
              route={route}
              confirmationCopied={copied === 'confirmation'}
              isFetching={isFetching}
              isConfirming={acknowledgeVerification.isPending}
              confirmationError={acknowledgeVerification.isError}
              onCopy={(value) => void copy(value, 'confirmation')}
              onRefresh={() => void refetch()}
              onMarkVerified={() => acknowledgeVerification.mutate()}
            />

            <div className='border-border flex flex-wrap items-center justify-between gap-3 border-t pt-5'>
              <p className='text-muted-foreground max-w-sm text-xs leading-relaxed'>
                {t('privacyNote')}
              </p>
              <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant='outline'
                    size='sm'
                    className='text-destructive hover:text-destructive'>
                    <Trash2 aria-hidden='true' /> {t('removeAddress')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('removeTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>{t('removeDescription')}</AlertDialogDescription>
                  </AlertDialogHeader>
                  {deleteRoute.isError && (
                    <p className='text-destructive text-sm' role='alert'>
                      {t('removeError')}
                    </p>
                  )}
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      variant='destructive'
                      disabled={deleteRoute.isPending}
                      onClick={(event) => {
                        event.preventDefault();
                        deleteRoute.mutate(undefined, { onSuccess: () => setRemoveOpen(false) });
                      }}>
                      {t('removeAddress')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
