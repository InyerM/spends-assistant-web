'use client';

import { usePathname } from 'next/navigation';

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

  return (
    <header className='border-border bg-sidebar-bg/50 flex h-14 shrink-0 items-center gap-4 border-b px-6 backdrop-blur-sm'>
      <h1 className='text-lg font-semibold text-white'>{title}</h1>
      <div className='flex-1' />
    </header>
  );
}
