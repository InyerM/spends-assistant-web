'use client';

import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Sidebar } from './sidebar';
import { useUiStore } from '@/store/ui-store';

const routeToTitle: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/transactions': 'Transactions',
  '/accounts': 'Accounts',
  '/categories': 'Categories',
  '/automation': 'Automation Rules',
  '/settings': 'Settings',
};

function getPageTitle(pathname: string): string {
  for (const [route, title] of Object.entries(routeToTitle)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      return title;
    }
  }
  return 'Dashboard';
}

export function Header(): React.ReactElement {
  const pathname = usePathname();
  const title = getPageTitle(pathname);
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);

  return (
    <header className='border-border bg-sidebar-bg/50 flex h-14 shrink-0 items-center gap-4 border-b px-6 backdrop-blur-sm'>
      <div className='md:hidden'>
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <button className='text-muted-foreground hover:text-foreground mr-2'>
              <Menu className='h-5 w-5' />
            </button>
          </SheetTrigger>
          <SheetContent side='left' className='border-r-sidebar-bg bg-sidebar-bg w-72 p-0'>
            <Sidebar className='w-full border-none' onClose={(): void => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      <h1 className='text-lg font-semibold text-white'>{title}</h1>
      <div className='flex-1' />
    </header>
  );
}
