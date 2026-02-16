'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { useDeleteAccount } from '@/lib/api/mutations/account.mutations';
import { AccountEditDialog } from '@/components/accounts/account-edit-dialog';
import { AccountCreateDialog } from '@/components/accounts/account-create-dialog';
import { SwipeableRow } from '@/components/transactions/swipeable-row';
import { formatCurrency } from '@/lib/utils/formatting';
import {
  Plus,
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
import { getAccountDisplayName } from '@/lib/utils/account-translations';
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

export default function AccountsPage(): React.ReactElement {
  const t = useTranslations('accounts');
  const locale = useLocale();
  const { data: accounts, isLoading } = useAccounts();
  const deleteMutation = useDeleteAccount();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success(t('accountDeleted'));
      setDeleteTarget(null);
    } catch {
      toast.error(t('failedToDelete'));
    }
  };

  return (
    <div className='space-y-4 p-4 sm:space-y-6 sm:p-6'>
      <div className='flex justify-end'>
        <Button onClick={(): void => setCreateOpen(true)}>
          <Plus className='h-4 w-4 sm:mr-2' />
          <span className='hidden sm:inline'>{t('newAccount')}</span>
        </Button>
      </div>

      {isLoading ? (
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className='border-border bg-card'>
              <CardHeader>
                <Skeleton className='h-5 w-32' />
              </CardHeader>
              <CardContent>
                <Skeleton className='h-8 w-40' />
                <Skeleton className='mt-2 h-4 w-24' />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {accounts?.map((account) => {
            const cardContent = (
              <Card className='border-border bg-card hover:border-primary/50 cursor-pointer transition-colors'>
                <CardHeader className='flex flex-row items-center justify-between space-y-0'>
                  <CardTitle className='text-base font-medium'>
                    <AccountTypeIcon type={account.type} className='mr-2 inline h-4 w-4' />
                    {account.is_default
                      ? getAccountDisplayName(account.name, locale)
                      : account.name}
                  </CardTitle>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={(e): void => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingAccount(account);
                    }}
                    className='hidden h-8 w-8 p-0 sm:flex'>
                    <Pencil className='h-4 w-4' />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div
                    className={`text-2xl font-bold ${account.balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(account.balance, account.currency)}
                  </div>
                  <div className='text-muted-foreground mt-2 flex items-center gap-2 text-sm'>
                    <span className='capitalize'>
                      {t(account.type === 'credit_card' ? 'creditCard' : account.type)}
                    </span>
                    {account.institution && <span>· {account.institution}</span>}
                    {account.last_four && <span>· •••• {account.last_four}</span>}
                  </div>
                </CardContent>
              </Card>
            );

            return (
              <div key={account.id}>
                {/* Desktop: regular link card */}
                <div className='hidden sm:block'>
                  <Link href={`/accounts/${account.id}`}>{cardContent}</Link>
                </div>
                {/* Mobile: swipeable card */}
                <div className='sm:hidden'>
                  <SwipeableRow
                    onEdit={(): void => setEditingAccount(account)}
                    onDelete={
                      account.is_default ? undefined : (): void => setDeleteTarget(account)
                    }>
                    <Link href={`/accounts/${account.id}`}>{cardContent}</Link>
                  </SwipeableRow>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AccountCreateDialog open={createOpen} onOpenChange={setCreateOpen} />

      <AccountEditDialog
        account={editingAccount}
        open={editingAccount !== null}
        onOpenChange={(open): void => {
          if (!open) setEditingAccount(null);
        }}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open): void => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('deleteAccount')}
        description={
          <p className='text-muted-foreground text-sm'>
            {t('deleteAccountConfirm', {
              name: deleteTarget?.name ?? '',
              txInfo: '',
            })}
          </p>
        }
        confirmText={deleteTarget?.name ?? ''}
        onConfirm={(): void => void handleDeleteConfirm()}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
