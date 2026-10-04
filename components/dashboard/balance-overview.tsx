'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
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

const ACCOUNT_TYPE_ICONS: Record<AccountType, LucideIcon> = {
  checking: Landmark,
  savings: PiggyBank,
  credit_card: CreditCard,
  cash: Banknote,
  investment: TrendingUp,
  crypto: Bitcoin,
  credit: HandCoins,
};

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
  locale?: string;
}

function AccountCard({ account, onEdit, onClick, locale }: AccountCardProps): React.ReactElement {
  const tCommon = useTranslations('common');
  const Icon = ACCOUNT_TYPE_ICONS[account.type];

  return (
    <div
      className='group border-border bg-card hover:bg-card-overlay focus-visible:ring-ring relative flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none'
      onClick={onClick}
      role='button'
      tabIndex={0}
      onKeyDown={(e): void => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}>
      <Icon className='text-success h-5 w-5 shrink-0' />
      <div className='min-w-0 flex-1'>
        <p className='text-foreground truncate text-sm font-semibold'>{account.name}</p>
        <p className='text-foreground text-sm tabular-nums'>
          {formatCurrency(account.balance, account.currency, locale)}
        </p>
      </div>
      {onEdit && (
        <button
          type='button'
          aria-label={`${tCommon('edit')} ${account.name}`}
          onClick={(e): void => {
            e.stopPropagation();
            onEdit(account);
          }}
          className='text-muted-foreground hover:text-foreground focus-visible:ring-ring cursor-pointer rounded-md p-2 focus-visible:ring-2 focus-visible:outline-none sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100'>
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
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const locale = useLocale();
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
      className='border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4 transition-colors'>
      <Plus className='h-5 w-5 shrink-0' />
      <div className='min-w-0 text-left'>
        <p className='text-sm font-semibold'>{t('addAccount')}</p>
        <p className='text-muted-foreground/60 text-sm'>{tCommon('new')}</p>
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
                    locale={locale}
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
            locale={locale}
          />
        ))}
        {addCard}
      </div>
    </>
  );
}
