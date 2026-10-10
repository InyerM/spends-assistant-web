'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { NotificationCenter } from '@/components/notifications/notification-center';

const routeToKey: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/notifications': 'notifications',
  '/transactions': 'transactions',
  '/documents': 'documents',
  '/inbox': 'emailInbox',
  '/accounts': 'accounts',
  '/investments': 'investments',
  '/loans': 'loans',
  '/receivables': 'receivables',
  '/relief-funds': 'reliefFunds',
  '/contacts': 'contacts',
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
      <NotificationCenter />
    </header>
  );
}
