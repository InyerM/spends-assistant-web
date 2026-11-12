'use client';

import { useTranslations } from 'next-intl';
import { AccountBalanceHero } from '@/components/accounts/account-balance-hero';
import { Skeleton } from '@/components/ui/skeleton';
import type { CurrencyBalance } from '@/lib/account-currency-balances';

export function DashboardCurrencyHero({
  balances,
  currency,
  onCurrencyChange,
  isLoading = false,
}: {
  balances: CurrencyBalance[];
  currency: string;
  onCurrencyChange: (currency: string) => void;
  isLoading?: boolean;
}): React.ReactElement | null {
  const t = useTranslations('dashboard');
  if (isLoading) return <Skeleton className='h-60 rounded-2xl' />;
  if (balances.length === 0) return null;
  const selected = balances.find((balance) => balance.currency === currency) ?? balances[0];
  return (
    <AccountBalanceHero
      ledgers={balances}
      selectedId={selected.id}
      onSelect={onCurrencyChange}
      label={t('currencyBalances')}
      description={t('currencyBalancesHint')}
    />
  );
}
