'use client';

import { AuthGuard } from '@/components/guards/auth-guard';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { TransactionForm } from '@/components/transactions/transaction-form';
import { AiParseDialog } from '@/components/transactions/ai-parse-dialog';
import { useTransactionFormStore } from '@/lib/stores/transaction-form.store';
import { Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactNode {
  const { open, transaction, aiOpen, setOpen, openNew, openAi, setAiOpen } =
    useTransactionFormStore();

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

      <div className='fixed right-6 bottom-22 z-50 flex flex-col gap-3 md:bottom-6 md:hidden'>
        <Button
          onClick={openAi}
          size='icon'
          className='ai-gradient-btn bg-card h-12 w-12 cursor-pointer rounded-full border-0 text-purple-400 shadow-lg hover:text-purple-300'>
          <Sparkles className='h-5 w-5' />
        </Button>
        <Button
          onClick={openNew}
          size='icon'
          className='h-14 w-14 cursor-pointer rounded-full shadow-lg'>
          <Plus className='h-6 w-6' />
        </Button>
      </div>

      <TransactionForm open={open} onOpenChange={setOpen} transaction={transaction} />
      <AiParseDialog open={aiOpen} onOpenChange={setAiOpen} />
    </AuthGuard>
  );
}
