'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { formatCurrency } from '@/lib/utils/formatting';
import { Wallet } from 'lucide-react';

export function BalanceOverview(): React.ReactElement {
  const { data: accounts, isLoading } = useAccounts();

  if (isLoading) {
    return (
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className='border-border bg-card'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <Skeleton className='h-4 w-24' />
            </CardHeader>
            <CardContent>
              <Skeleton className='h-8 w-32' />
              <Skeleton className='mt-2 h-3 w-20' />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const totalBalance = accounts?.reduce((sum, acc) => sum + acc.balance, 0) ?? 0;

  return (
    <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
      <Card className='border-border bg-card'>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-muted-foreground text-sm font-medium'>Total Balance</CardTitle>
          <Wallet className='text-muted-foreground h-4 w-4' />
        </CardHeader>
        <CardContent>
          <div className='text-success text-2xl font-bold'>{formatCurrency(totalBalance)}</div>
          <p className='text-muted-foreground text-xs'>Across {accounts?.length ?? 0} accounts</p>
        </CardContent>
      </Card>

      {accounts?.map((account) => (
        <Card key={account.id} className='border-border bg-card'>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-muted-foreground text-sm font-medium'>
              {account.name}
            </CardTitle>
            <span className='text-lg'>{account.icon ?? '💳'}</span>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${account.balance >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(account.balance, account.currency)}
            </div>
            <p className='text-muted-foreground text-xs'>
              {account.institution ?? account.type}
              {account.last_four ? ` •••• ${account.last_four}` : ''}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
