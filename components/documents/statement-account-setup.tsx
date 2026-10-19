'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocumentAccountSelect } from './document-review-selects';
import { AccountCreateDialog } from '@/components/accounts/account-create-dialog';
import { EnableCurrency } from '@/components/accounts/enable-currency';
import { groupAccounts } from '@/lib/accounts/currency-groups';
import type { Account } from '@/types';
export function StatementAccountSetup({
  accounts,
  currency,
  value,
  disabled,
  onChange,
}: {
  accounts: Account[];
  currency: string;
  value: string;
  disabled: boolean;
  onChange: (id: string) => void;
}): React.ReactElement {
  const t = useTranslations('statementReconciliation');
  const [existing, setExisting] = useState('');
  const [create, setCreate] = useState(false);
  const [setup, setSetup] = useState(false);
  const groups = groupAccounts(accounts.filter((a) => a.is_active));
  const candidates = groups
    .filter((g) => !g.ledgers.some((a) => a.currency === currency))
    .map((g) => g.account);
  const target = candidates.find((a) => a.id === existing);
  return (
    <div className='space-y-3'>
      <DocumentAccountSelect
        value={value}
        accounts={accounts.filter((a) => a.is_active && a.currency === currency)}
        label={t('account')}
        disabled={disabled}
        onChange={onChange}
      />
      {!disabled && (
        <>
          <Button
            size='sm'
            variant='outline'
            className='w-full justify-start'
            onClick={() => setSetup(!setup)}
            aria-expanded={setup}>
            <Plus className='size-4' />
            {t('setupCurrency', { currency })}
          </Button>
          {setup && (
            <div className='border-border space-y-3 rounded-lg border p-3'>
              <p className='text-sm font-medium'>{t('useExistingAccount')}</p>
              <p className='text-muted-foreground text-xs'>
                {t('enableCurrencyHint', { currency })}
              </p>
              {candidates.length > 0 && (
                <DocumentAccountSelect
                  accounts={candidates}
                  value={existing}
                  label={t('useExistingAccount')}
                  onChange={setExisting}
                />
              )}
              {target && (
                <EnableCurrency
                  account={target}
                  currency={currency}
                  onEnabled={(a) => {
                    onChange(a.id);
                    setSetup(false);
                  }}
                />
              )}
              <Button size='sm' variant='ghost' onClick={() => setCreate(true)}>
                {t('createCurrencyAccount', { currency })}
              </Button>
            </div>
          )}
        </>
      )}
      {create && (
        <AccountCreateDialog
          open
          onOpenChange={setCreate}
          initialCurrency={currency}
          onCreated={(a) => {
            if (a.currency === currency) onChange(a.id);
            setSetup(false);
          }}
        />
      )}
    </div>
  );
}
