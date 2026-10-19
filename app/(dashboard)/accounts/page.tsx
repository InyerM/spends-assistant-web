'use client';

import { groupAccounts } from '@/lib/accounts/currency-groups';
import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { useDeleteAccount } from '@/lib/api/mutations/account.mutations';
import { AccountEditDialog } from '@/components/accounts/account-edit-dialog';
import { AccountCreateDialog } from '@/components/accounts/account-create-dialog';
import { SwipeableRow } from '@/components/transactions/swipeable-row';
import { SearchInput } from '@/components/shared/search-input';
import { Plus } from 'lucide-react';
import { AccountCurrencyCard } from '@/components/accounts/account-currency-card';
import type { Account } from '@/types';

export default function AccountsPage(): React.ReactElement {
  const t = useTranslations('accounts');
  const tCommon = useTranslations('common');
  const { data: accounts, isLoading } = useAccounts();
  const deleteMutation = useDeleteAccount();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

  const filteredAccounts = useMemo((): Account[] | undefined => {
    if (!accounts) return undefined;
    if (!search.trim()) return accounts;
    const q = search.toLowerCase();
    return accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.institution?.toLowerCase().includes(q) ||
        a.last_four?.includes(q),
    );
  }, [accounts, search]);

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
    <div className='mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8'>
      <header>
        <h1 className='text-2xl font-semibold tracking-tight'>{t('title')}</h1>
        <p className='text-muted-foreground mt-1 text-sm'>{t('overviewHint')}</p>
      </header>
      <div className='flex items-center gap-3'>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={`${tCommon('search')}...`}
          className='min-w-[140px] flex-1 sm:min-w-[180px]'
        />
        <Button
          aria-label={t('newAccount')}
          className='shrink-0 cursor-pointer'
          onClick={(): void => setCreateOpen(true)}>
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
          {groupAccounts(accounts ?? [])
            .filter((group) =>
              group.ledgers.some((a) => filteredAccounts?.some((f) => f.id === a.id)),
            )
            .map(({ account, ledgers }) => {
              const cardContent = (
                <AccountCurrencyCard
                  account={account}
                  ledgers={ledgers}
                  onEdit={() => setEditingAccount(account)}
                />
              );

              return (
                <div key={account.id}>
                  {/* Desktop: regular link card */}
                  <div className='hidden sm:block'>{cardContent}</div>
                  {/* Mobile: swipeable card */}
                  <div className='sm:hidden'>
                    <SwipeableRow
                      onEdit={(): void => setEditingAccount(account)}
                      onDelete={
                        account.is_default ? undefined : (): void => setDeleteTarget(account)
                      }>
                      {cardContent}
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
