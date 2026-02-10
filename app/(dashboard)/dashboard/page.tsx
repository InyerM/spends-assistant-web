'use client';

import { BalanceOverview } from '@/components/dashboard/balance-overview';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';

export default function DashboardPage(): React.ReactElement {
  return (
    <div className='space-y-6 p-6'>
      <div>
        <h2 className='text-foreground text-2xl font-bold'>Overview</h2>
        <p className='text-muted-foreground text-sm'>Your financial summary at a glance</p>
      </div>

      <BalanceOverview />
      <RecentTransactions />
    </div>
  );
}
