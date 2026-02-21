'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  ArrowRightLeft,
  Wallet,
  Tags,
  MoreHorizontal,
  Zap,
  Settings,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/use-auth';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  titleKey: string;
  href: string;
  icon: LucideIcon;
}

const mainItems: NavItem[] = [
  { titleKey: 'home', href: '/dashboard', icon: LayoutDashboard },
  { titleKey: 'transactions', href: '/transactions', icon: ArrowRightLeft },
  { titleKey: 'accounts', href: '/accounts', icon: Wallet },
  { titleKey: 'categories', href: '/categories', icon: Tags },
];

const moreItems: NavItem[] = [
  { titleKey: 'automation', href: '/automation', icon: Zap },
  { titleKey: 'settings', href: '/settings', icon: Settings },
];

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}

export function BottomNav(): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const { user, signOut } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const avatarUrl = user?.user_metadata.avatar_url as string | undefined;
  const displayName = (user?.user_metadata.display_name as string | undefined) ?? user?.email;

  const moreActive = moreItems.some((item) => isActivePath(pathname, item.href));

  const handleNav = (href: string): void => {
    router.push(href);
    setMoreOpen(false);
  };

  const handleLogout = async (): Promise<void> => {
    await signOut();
    router.push('/login');
    setMoreOpen(false);
  };

  return (
    <>
      <nav className='border-border bg-card fixed right-0 bottom-0 left-0 z-50 border-t pb-[env(safe-area-inset-bottom)] md:hidden'>
        <div className='flex h-16 items-center justify-around'>
          {mainItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Button
                key={item.href}
                variant='ghost'
                onClick={(): void => handleNav(item.href)}
                className={cn(
                  'h-auto flex-1 cursor-pointer flex-col gap-1 rounded-none py-2 text-xs font-medium',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}>
                <item.icon className='h-5 w-5' />
                <span>{t(item.titleKey)}</span>
              </Button>
            );
          })}
          <Button
            variant='ghost'
            onClick={(): void => setMoreOpen(true)}
            className={cn(
              'h-auto flex-1 cursor-pointer flex-col gap-1 rounded-none py-2 text-xs font-medium',
              moreActive ? 'text-primary' : 'text-muted-foreground',
            )}>
            <MoreHorizontal className='h-5 w-5' />
            <span>{t('more')}</span>
          </Button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side='bottom' className='border-border bg-card'>
          <SheetHeader>
            <SheetTitle>{t('more')}</SheetTitle>
          </SheetHeader>
          <div className='space-y-1 py-4'>
            <div className='mb-3 flex items-center gap-3 px-3'>
              <Avatar size='sm'>
                {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName ?? ''} />}
                <AvatarFallback>{(user?.email ?? '?').slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className='text-muted-foreground min-w-0 truncate text-sm'>{displayName}</span>
            </div>
            <div className='border-border mb-2 border-t' />
            {moreItems.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Button
                  key={item.href}
                  variant='ghost'
                  onClick={(): void => handleNav(item.href)}
                  className={cn(
                    'h-auto w-full cursor-pointer justify-start gap-3 rounded-lg px-3 py-3 text-sm font-medium',
                    active
                      ? 'bg-primary hover:bg-primary/90 text-white'
                      : 'text-foreground hover:bg-card-overlay',
                  )}>
                  <item.icon className='h-5 w-5' />
                  <span>{t(item.titleKey)}</span>
                </Button>
              );
            })}
            <div className='border-border my-2 border-t' />
            <Button
              variant='ghost'
              onClick={(): void => void handleLogout()}
              className='text-destructive hover:bg-card-overlay h-auto w-full cursor-pointer justify-start gap-3 rounded-lg px-3 py-3 text-sm font-medium'>
              <LogOut className='h-5 w-5' />
              <span>{tCommon('signOut')}</span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
