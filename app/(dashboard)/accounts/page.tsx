'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { AccountEditDialog } from '@/components/accounts/account-edit-dialog';
import { AccountCreateDialog } from '@/components/accounts/account-create-dialog';
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
  const { data: accounts, isLoading } = useAccounts();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  return (
    <div className='space-y-4 p-4 sm:space-y-6 sm:p-6'>
      <div className='flex items-center justify-between'>
        <div className='min-w-0'>
          <h2 className='text-foreground text-xl font-bold sm:text-2xl'>Accounts</h2>
          <p className='text-muted-foreground hidden text-sm sm:block'>
            Manage your financial accounts
          </p>
        </div>
        <Button onClick={(): void => setCreateOpen(true)}>
          <Plus className='h-4 w-4 sm:mr-2' />
          <span className='hidden sm:inline'>New Account</span>
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
          {accounts?.map((account) => (
            <Link key={account.id} href={`/accounts/${account.id}`}>
              <Card className='border-border bg-card hover:border-primary/50 cursor-pointer transition-colors'>
                <CardHeader className='flex flex-row items-center justify-between space-y-0'>
                  <CardTitle className='text-base font-medium'>
                    <AccountTypeIcon type={account.type} className='mr-2 inline h-4 w-4' />
                    {account.name}
                  </CardTitle>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={(e): void => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingAccount(account);
                    }}
                    className='h-9 w-9 p-0 sm:h-8 sm:w-8'>
                    <Pencil className='h-4 w-4' />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div
                    className={`text-2xl font-bold ${account.balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(account.balance, account.currency)}
                  </div>
                  <div className='text-muted-foreground mt-2 flex items-center gap-2 text-sm'>
                    <span className='capitalize'>{account.type.replace('_', ' ')}</span>
                    {account.institution && <span>· {account.institution}</span>}
                    {account.last_four && <span>· •••• {account.last_four}</span>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
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
    </div>
  );
}
