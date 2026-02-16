'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const routeToKey: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/transactions': 'transactions',
  '/accounts': 'accounts',
  '/categories': 'categories',
  '/automation': 'automation',
  '/settings': 'settings',
};

function getPageTitleKey(pathname: string): string {
  for (const [route, key] of Object.entries(routeToKey)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      return key;
    }
  }
  return 'dashboard';
}

export function Header(): React.ReactElement {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const titleKey = getPageTitleKey(pathname);

  return (
    <header className='border-border bg-sidebar-bg/50 hidden h-14 shrink-0 items-center gap-4 border-b px-6 backdrop-blur-sm md:flex'>
      <h1 className='text-foreground text-lg font-semibold'>{t(titleKey)}</h1>
      <div className='flex-1' />
    </header>
  );
}
