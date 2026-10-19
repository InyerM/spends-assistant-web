'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InlineLoader } from '@/components/shared/loader';
import { useEnableAccountCurrency } from '@/lib/api/mutations/account.mutations';
import type { Account } from '@/types';
export function EnableCurrency({
  account,
  currency,
  onEnabled,
}: {
  account: Account;
  currency: string;
  onEnabled: (account: Account) => void;
}): React.ReactElement {
  const t = useTranslations('accounts');
  const [confirm, setConfirm] = useState(false);
  const mutation = useEnableAccountCurrency();
  return (
    <div className='space-y-2'>
      {confirm ? (
        <div className='bg-muted/40 space-y-3 rounded-lg p-3'>
          <p className='text-sm'>{t('enableCurrencyConfirm', { name: account.name, currency })}</p>
          <p className='text-muted-foreground text-xs'>{t('separateBalances')}</p>
          <div className='flex flex-wrap gap-2'>
            <Button
              size='sm'
              disabled={mutation.isPending}
              onClick={() =>
                mutation.mutate(
                  { id: account.id, currency },
                  {
                    onSuccess: (created) => {
                      setConfirm(false);
                      onEnabled(created);
                    },
                  },
                )
              }>
              {mutation.isPending ? <InlineLoader /> : <Check className='size-4' />}
              {t('enableCurrency', { currency })}
            </Button>
            <Button
              variant='ghost'
              size='sm'
              disabled={mutation.isPending}
              onClick={() => setConfirm(false)}>
              {t('cancelCurrency')}
            </Button>
          </div>
        </div>
      ) : (
        <Button size='sm' variant='outline' onClick={() => setConfirm(true)}>
          <Plus className='size-4' />
          {t('addCurrency', { currency })}
        </Button>
      )}
      {mutation.error && (
        <p role='alert' className='text-destructive text-xs'>
          {t('currencyError')}
        </p>
      )}
    </div>
  );
}
