'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { formatCurrency } from '@/lib/utils/formatting';
import type { LucideIcon } from 'lucide-react';
import {
  Pencil,
  Plus,
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

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

interface AccountCardProps {
  account: Account;
  onEdit?: (account: Account) => void;
  onClick: () => void;
}

function AccountCard({ account, onEdit, onClick }: AccountCardProps): React.ReactElement {
  const rawColor = account.color ?? FALLBACK_COLORS[account.type];
  const bgColor = darkenColor(rawColor);
  const Icon = ACCOUNT_TYPE_ICONS[account.type];

  return (
    <div
      className='group relative flex cursor-pointer items-center gap-3 rounded-xl p-4 transition-opacity hover:opacity-90'
      style={{ backgroundColor: bgColor }}
      onClick={onClick}
      role='button'
      tabIndex={0}
      onKeyDown={(e): void => {
        if (e.key === 'Enter') onClick();
      }}>
      <Icon className='h-5 w-5 shrink-0 text-white/70' />
      <div className='min-w-0 flex-1'>
        <p className='truncate text-sm font-semibold text-white'>{account.name}</p>
        <p className='text-sm text-white/80'>{formatCurrency(account.balance, account.currency)}</p>
      </div>
      {onEdit && (
        <button
          onClick={(e): void => {
            e.stopPropagation();
            onEdit(account);
          }}
          className='cursor-pointer rounded-md p-1 text-white/60 opacity-0 transition-opacity group-hover:opacity-100 hover:text-white'>
          <Pencil className='h-3.5 w-3.5' />
        </button>
      )}
    </div>
  );
}

interface BalanceOverviewProps {
  onEditAccount?: (account: Account) => void;
  onAddAccount?: () => void;
}

export function BalanceOverview({
  onEditAccount,
  onAddAccount,
}: BalanceOverviewProps): React.ReactElement {
  const { data: accounts, isLoading } = useAccounts();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  const accountList = accounts ?? [];
  const mobilePages = chunk(accountList, 4);
  const lastPageFull = accountList.length > 0 && accountList.length % 4 === 0;
  const needsExtraPage = onAddAccount && (lastPageFull || accountList.length === 0);
  const totalSlides = mobilePages.length + (needsExtraPage ? 1 : 0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = (): void => {
      const gap = 12; // matches gap-3 (0.75rem)
      const idx = Math.round(el.scrollLeft / (el.clientWidth + gap));
      setActiveSlide(idx);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return (): void => el.removeEventListener('scroll', handleScroll);
  }, []);

  if (isLoading) {
    return (
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className='h-[76px] rounded-xl' />
        ))}
      </div>
    );
  }

  const addCard = onAddAccount ? (
    <button
      onClick={onAddAccount}
      className='border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed p-4 transition-colors'>
      <Plus className='h-5 w-5 shrink-0' />
      <div className='min-w-0 text-left'>
        <p className='text-sm font-semibold'>Add Account</p>
        <p className='text-muted-foreground/60 text-sm'>New</p>
      </div>
    </button>
  ) : null;

  return (
    <>
      {/* Mobile: horizontal carousel */}
      <div className='sm:hidden'>
        <div
          ref={scrollRef}
          className='scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto'>
          {mobilePages.map((page, pageIdx) => {
            const isLastPage = pageIdx === mobilePages.length - 1;
            const showAddHere = isLastPage && onAddAccount && page.length < 4;
            return (
              <div
                key={pageIdx}
                className='grid w-full min-w-full shrink-0 snap-center grid-cols-2 content-start gap-2'>
                {page.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    onEdit={onEditAccount}
                    onClick={(): void => router.push(`/accounts/${account.id}`)}
                  />
                ))}
                {showAddHere && addCard}
              </div>
            );
          })}
          {needsExtraPage && (
            <div className='grid w-full min-w-full shrink-0 snap-center grid-cols-2 content-start gap-2'>
              {addCard}
            </div>
          )}
        </div>
        {/* Dot indicators */}
        {totalSlides > 1 && (
          <div className='mt-2 flex justify-center gap-1.5'>
            {Array.from({ length: totalSlides }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === activeSlide ? 'bg-foreground w-4' : 'bg-muted-foreground/30 w-1.5'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: grid */}
      <div className='hidden gap-3 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'>
        {accountList.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            onEdit={onEditAccount}
            onClick={(): void => router.push(`/accounts/${account.id}`)}
          />
        ))}
        {addCard}
      </div>
    </>
  );
}
