'use client';

import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { formatCurrency } from '@/lib/utils/formatting';
import type { LucideIcon } from 'lucide-react';
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
import type { Account, AccountType } from '@/types';

const FALLBACK_COLORS: Record<AccountType, string> = {
  checking: '#2563eb',
  savings: '#059669',
  credit_card: '#d97706',
  cash: '#16a34a',
  investment: '#7c3aed',
  crypto: '#ca8a04',
  credit: '#e11d48',
};

const ACCOUNT_TYPE_ICONS: Record<AccountType, LucideIcon> = {
  checking: Landmark,
  savings: PiggyBank,
  credit_card: CreditCard,
  cash: Banknote,
  investment: TrendingUp,
  crypto: Bitcoin,
  credit: HandCoins,
};

function darkenColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const factor = 0.55;
  const dr = Math.round(r * factor);
  const dg = Math.round(g * factor);
  const db = Math.round(b * factor);
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
}

interface BalanceOverviewProps {
  onEditAccount?: (account: Account) => void;
}

export function BalanceOverview({ onEditAccount }: BalanceOverviewProps): React.ReactElement {
  const { data: accounts, isLoading } = useAccounts();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className='h-[76px] rounded-xl' />
        ))}
      </div>
    );
  }

  return (
    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'>
      {accounts?.map((account) => {
        const rawColor = account.color ?? FALLBACK_COLORS[account.type];
        const bgColor = darkenColor(rawColor);
        const Icon = ACCOUNT_TYPE_ICONS[account.type];

        return (
          <div
            key={account.id}
            className='group relative flex cursor-pointer items-center gap-3 rounded-xl p-4 transition-opacity hover:opacity-90'
            style={{ backgroundColor: bgColor }}
            onClick={(): void => router.push(`/accounts/${account.id}`)}
            role='button'
            tabIndex={0}
            onKeyDown={(e): void => {
              if (e.key === 'Enter') router.push(`/accounts/${account.id}`);
            }}>
            <Icon className='h-5 w-5 shrink-0 text-white/70' />
            <div className='min-w-0 flex-1'>
              <p className='truncate text-sm font-semibold text-white'>{account.name}</p>
              <p className='text-sm text-white/80'>
                {formatCurrency(account.balance, account.currency)}
              </p>
            </div>
            {onEditAccount && (
              <button
                onClick={(e): void => {
                  e.stopPropagation();
                  onEditAccount(account);
                }}
                className='cursor-pointer rounded-md p-1 text-white/60 opacity-0 transition-opacity group-hover:opacity-100 hover:text-white'>
                <Pencil className='h-3.5 w-3.5' />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
