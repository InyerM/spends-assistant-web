'use client';

import { usePathname } from 'next/navigation';
import { AuthGuard } from '@/components/guards/auth-guard';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { TransactionForm } from '@/components/transactions/transaction-form';
import { useTransactionFormStore } from '@/lib/stores/transaction-form.store';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FAB_PAGES = ['/dashboard', '/transactions'];

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactNode {
  const pathname = usePathname();
  const { open, transaction, setOpen, openNew } = useTransactionFormStore();

  const showFab = FAB_PAGES.some((p) => pathname === p || pathname.startsWith(p + '/'));

  return (
    <AuthGuard>
      <div className='bg-background h-screen-safe flex'>
        <div className='hidden md:flex'>
          <Sidebar />
        </div>
        <div className='flex flex-1 flex-col overflow-hidden'>
          <Header />
          <main className='flex-1 overflow-auto pb-20 md:pb-0'>{children}</main>
        </div>
      </div>

      <BottomNav />

      {showFab && (
        <div className='fixed right-6 bottom-22 z-50 md:bottom-6 md:hidden'>
          <Button
            onClick={openNew}
            size='icon'
            className='h-14 w-14 cursor-pointer rounded-full shadow-lg'>
            <Plus className='h-6 w-6' />
          </Button>
        </div>
      )}

      <TransactionForm open={open} onOpenChange={setOpen} transaction={transaction} />
    </AuthGuard>
  );
}
