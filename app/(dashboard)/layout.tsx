'use client';

import { AuthGuard } from '@/components/guards/auth-guard';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactNode {
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
    </AuthGuard>
  );
}
