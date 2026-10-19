'use client';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/formatting';
import { getAccountDisplayName } from '@/lib/utils/account-translations';
import {
  Pencil,
  Landmark,
  PiggyBank,
  CreditCard,
  Banknote,
  TrendingUp,
  Bitcoin,
  HandCoins,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Account, AccountType } from '@/types';
const ACCOUNT_TYPE_ICONS: Record<AccountType, LucideIcon> = {
  checking: Landmark,
  savings: PiggyBank,
  credit_card: CreditCard,
  cash: Banknote,
  investment: TrendingUp,
  crypto: Bitcoin,
  credit: HandCoins,
};

function AccountTypeIcon({
  type,
  className,
}: {
  type: AccountType;
  className?: string;
}): React.ReactElement {
  const Icon = ACCOUNT_TYPE_ICONS[type];
  return <Icon className={className} />;
}

export function AccountCurrencyCard({
  account,
  ledgers,
  onEdit,
}: {
  account: Account;
  ledgers: Account[];
  onEdit: () => void;
}): React.ReactElement {
  const t = useTranslations('accounts'),
    tCommon = useTranslations('common'),
    locale = useLocale();
  return (
    <Card className='border-border bg-card hover:border-primary/50 transition-colors'>
      <CardHeader className='flex flex-row items-center justify-between space-y-0'>
        <CardTitle className='min-w-0 text-base font-medium wrap-anywhere'>
          <AccountTypeIcon type={account.type} className='mr-2 inline h-4 w-4' />
          <Link className='hover:underline' href={`/accounts/${account.id}`}>
            {account.is_default ? getAccountDisplayName(account.name, locale) : account.name}
          </Link>
        </CardTitle>
        <Button
          variant='ghost'
          size='sm'
          onClick={(e): void => {
            e.preventDefault();
            e.stopPropagation();
            onEdit();
          }}
          aria-label={tCommon('edit')}
          className='hidden h-8 w-8 shrink-0 p-0 sm:flex'>
          <Pencil className='h-4 w-4' />
        </Button>
      </CardHeader>
      <CardContent>
        <div className='space-y-2'>
          {ledgers.map((ledger) => (
            <div
              className='flex min-w-0 flex-wrap items-baseline justify-between gap-2'
              key={ledger.id}>
              <span className='text-muted-foreground text-xs'>{ledger.currency}</span>
              <span
                className={`min-w-0 text-xl font-semibold tracking-tight wrap-anywhere tabular-nums ${ledger.balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(ledger.balance, ledger.currency, locale)}
              </span>
            </div>
          ))}
        </div>
        <div className='text-muted-foreground mt-2 flex items-center gap-2 text-sm'>
          <span className='capitalize'>
            {t(account.type === 'credit_card' ? 'creditCard' : account.type)}
          </span>
          {account.institution && !account.is_default && <span>· {account.institution}</span>}
          {account.last_four && <span>· •••• {account.last_four}</span>}
        </div>
        <Link className='text-success mt-3 inline-block text-sm' href={`/accounts/${account.id}`}>
          {t('viewAccount')}
        </Link>
      </CardContent>
    </Card>
  );
}
