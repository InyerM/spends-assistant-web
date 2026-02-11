'use client';

import { AuthGuard } from '@/components/guards/auth-guard';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { TransactionForm } from '@/components/transactions/transaction-form';
import { useTransactionFormStore } from '@/lib/stores/transaction-form.store';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactNode {
  const { open, transaction, setOpen, openNew } = useTransactionFormStore();

  return (
    <AuthGuard>
      <div className='bg-background flex h-screen'>
        <div className='hidden md:flex'>
          <Sidebar />
        </div>
        <div className='flex flex-1 flex-col overflow-hidden'>
          <Header />
          <main className='flex-1 overflow-auto'>{children}</main>
        </div>
      </div>

      <Button
        onClick={openNew}
        size='icon'
        className='fixed right-6 bottom-6 z-50 h-14 w-14 cursor-pointer rounded-full shadow-lg md:hidden'>
        <Plus className='h-6 w-6' />
      </Button>

      <TransactionForm open={open} onOpenChange={setOpen} transaction={transaction} />
    </AuthGuard>
  );
}
