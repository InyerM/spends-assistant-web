'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useAccount } from '@/lib/api/queries/account.queries';
import { useTransactions } from '@/lib/api/queries/transaction.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import { useDeleteAccount } from '@/lib/api/mutations/account.mutations';
import { AccountEditDialog } from '@/components/accounts/account-edit-dialog';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import { formatCurrency } from '@/lib/utils/formatting';
import { formatDateForDisplay, formatTimeForDisplay } from '@/lib/utils/date';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  Landmark,
  PiggyBank,
  CreditCard,
  Banknote,
  TrendingUp,
  Bitcoin,
  HandCoins,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AccountType, TransactionType } from '@/types';
import { Badge } from '@/components/ui/badge';

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

const typeConfig: Record<TransactionType, { icon: typeof ArrowDownLeft; colorClass: string }> = {
  expense: { icon: ArrowUpRight, colorClass: 'text-destructive' },
  income: { icon: ArrowDownLeft, colorClass: 'text-success' },
  transfer: { icon: ArrowRightLeft, colorClass: 'text-transfer' },
};

export default function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.ReactElement {
  const { id } = use(params);
  const router = useRouter();
  const { data: account, isLoading } = useAccount(id);
  const { data: txResult } = useTransactions({ account_id: id, limit: 100 });
  const { data: categories } = useCategories();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const deleteMutation = useDeleteAccount();
  const txCount = txResult?.count ?? 0;

  async function handleDelete(): Promise<void> {
    if (!account) return;
    try {
      await deleteMutation.mutateAsync(account.id);
      toast.success('Account deleted');
      setConfirmDeleteOpen(false);
      router.push('/accounts');
    } catch {
      toast.error('Failed to delete account');
    }
  }

  const getCategoryName = (categoryId: string | null): string | null => {
    if (!categoryId || !categories) return null;
    return categories.find((c) => c.id === categoryId)?.name ?? null;
  };

  if (isLoading) {
    return (
      <div className='space-y-6 p-6'>
        <Skeleton className='h-8 w-48' />
        <Skeleton className='h-24 w-full' />
        <Skeleton className='h-64 w-full' />
      </div>
    );
  }

  if (!account) {
    return (
      <div className='p-6'>
        <p className='text-muted-foreground'>Account not found</p>
      </div>
    );
  }

  const transactions = txResult?.data ?? [];

  return (
    <div className='space-y-6 p-6'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <Button
            variant='ghost'
            size='icon'
            className='cursor-pointer'
            onClick={(): void => router.push('/accounts')}>
            <ArrowLeft className='h-5 w-5' />
          </Button>
          <h2 className='text-foreground text-2xl font-bold'>Account Detail</h2>
        </div>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            className='cursor-pointer'
            onClick={(): void => setEditOpen(true)}>
            <Pencil className='mr-2 h-4 w-4' />
            Edit
          </Button>
          <Button
            variant='outline'
            className='text-destructive cursor-pointer'
            onClick={(): void => setConfirmDeleteOpen(true)}>
            <Trash2 className='mr-2 h-4 w-4' />
            Delete
          </Button>
        </div>
      </div>

      <Card className='border-border bg-card'>
        <CardContent className='flex items-center gap-4 p-6'>
          <AccountTypeIcon type={account.type} className='text-muted-foreground h-10 w-10' />
          <div>
            <p className='text-foreground text-lg font-semibold'>{account.name}</p>
            <p className='text-muted-foreground text-sm capitalize'>
              {account.type.replace('_', ' ')}
              {account.institution ? ` · ${account.institution}` : ''}
              {account.last_four ? ` · •••• ${account.last_four}` : ''}
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue='balance'>
        <TabsList>
          <TabsTrigger value='balance' className='cursor-pointer'>
            Balance
          </TabsTrigger>
          <TabsTrigger value='records' className='cursor-pointer'>
            Records
          </TabsTrigger>
        </TabsList>

        <TabsContent value='balance' className='mt-4'>
          <Card className='border-border bg-card'>
            <CardContent className='p-6'>
              <p className='text-muted-foreground text-sm'>Current Balance</p>
              <p
                className={`text-3xl font-bold ${account.balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(account.balance, account.currency)}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='records' className='mt-4'>
          <p className='text-muted-foreground mb-4 text-sm'>
            {transactions.length} transactions found
          </p>
          {transactions.length === 0 ? (
            <p className='text-muted-foreground py-8 text-center text-sm'>
              No transactions for this account
            </p>
          ) : (
            <div className='space-y-0.5'>
              {transactions.map((tx) => {
                const config = typeConfig[tx.type];
                const Icon = config.icon;
                const categoryName = getCategoryName(tx.category_id);

                return (
                  <div
                    key={tx.id}
                    className='hover:bg-card-overlay flex items-center gap-3 rounded-lg p-3'>
                    <div
                      className={`bg-card-overlay flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${config.colorClass}`}>
                      <Icon className='h-4 w-4' />
                    </div>
                    <div className='min-w-0 flex-1'>
                      <p className='text-foreground truncate text-sm font-medium'>
                        {tx.description}
                      </p>
                      <div className='text-muted-foreground flex items-center gap-1.5 text-xs'>
                        <span>{formatDateForDisplay(tx.date)}</span>
                        {categoryName && (
                          <>
                            <span>·</span>
                            <Badge variant='secondary' className='h-5 px-1.5 text-[10px]'>
                              {categoryName}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                    <div className='shrink-0 text-right'>
                      <p className={`text-sm font-semibold ${config.colorClass}`}>
                        {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}
                        {formatCurrency(tx.amount)}
                      </p>
                      <p className='text-muted-foreground text-xs'>
                        {formatTimeForDisplay(tx.time)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AccountEditDialog account={account} open={editOpen} onOpenChange={setEditOpen} />

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title='Delete Account'
        description={
          <p className='text-muted-foreground text-sm'>
            This will permanently delete <strong>{account.name}</strong>
            {txCount > 0 && (
              <>
                {' '}
                and its <strong>{txCount}</strong> transaction{txCount !== 1 && 's'}
              </>
            )}
            . This action cannot be undone.
          </p>
        }
        confirmText={account.name}
        onConfirm={handleDelete}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
