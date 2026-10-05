'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useEmailForwardingRoute } from '@/lib/api/queries/email-forwarding.queries';
import { useUiStore } from '@/store/ui-store';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ArrowRightLeft,
  Wallet,
  Tags,
  Zap,
  Menu,
  LogOut,
  Settings,
  Files,
  Mail,
  TrendingUp,
  Landmark,
  HandCoins,
  HeartHandshake,
} from 'lucide-react';
import { AnottoWordmark } from '@/components/layout/anotto-wordmark';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface NavItem {
  titleKey: string;
  href: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { titleKey: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { titleKey: 'transactions', href: '/transactions', icon: ArrowRightLeft },
  { titleKey: 'documents', href: '/documents', icon: Files },
  { titleKey: 'emailInbox', href: '/inbox', icon: Mail },
  { titleKey: 'accounts', href: '/accounts', icon: Wallet },
  { titleKey: 'investments', href: '/investments', icon: TrendingUp },
  { titleKey: 'loans', href: '/loans', icon: Landmark },
  { titleKey: 'receivables', href: '/receivables', icon: HandCoins },
  { titleKey: 'reliefFunds', href: '/relief-funds', icon: HeartHandshake },
  { titleKey: 'categories', href: '/categories', icon: Tags },
  { titleKey: 'automation', href: '/automation', icon: Zap },
];

interface SidebarProps {
  className?: string;
  onClose?: () => void;
}

function getUserInitials(email: string | undefined): string {
  if (!email) return '?';
  return email.slice(0, 2).toUpperCase();
}

export function Sidebar({ className, onClose }: SidebarProps): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const { user, signOut } = useAuth();
  const { data: forwardingRoute } = useEmailForwardingRoute();
  const emailInboxReady =
    forwardingRoute?.status === 'active' && Boolean(forwardingRoute.user_confirmed_at);
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleCollapsed = useUiStore((state) => state.toggleSidebarCollapsed);
  const isCollapsed = !onClose && sidebarCollapsed;

  const handleLogout = async (): Promise<void> => {
    await signOut();
    router.push('/login');
    onClose?.();
  };

  const handleNavigation = (path: string): void => {
    router.push(path);
    onClose?.();
  };

  const isActivePath = (href: string): boolean => {
    return pathname === href || pathname.startsWith(href + '/');
  };

  const avatarUrl = user?.user_metadata.avatar_url as string | undefined;
  const displayName = (user?.user_metadata.display_name as string | undefined) ?? user?.email;

  return (
    <aside
      className={cn(
        'border-border bg-sidebar-bg relative flex h-full flex-col border-r transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64',
        className,
      )}>
      {!onClose && (
        <Button
          variant='outline'
          size='icon-sm'
          onClick={toggleCollapsed}
          aria-label={t(isCollapsed ? 'expandSidebar' : 'collapseSidebar')}
          aria-expanded={!isCollapsed}
          className='bg-sidebar-bg hover:bg-card-overlay absolute top-11 -right-4 z-50 cursor-pointer rounded-lg shadow-lg'>
          <Menu className='text-muted-foreground h-4 w-4' />
        </Button>
      )}

      <div className='border-border flex h-16 items-center border-b px-4'>
        <div className={cn('flex items-center gap-3', isCollapsed && 'w-full justify-center')}>
          <AnottoWordmark compact={isCollapsed} />
        </div>
      </div>

      <nav
        aria-label={t('primaryNavigation')}
        className='flex-1 space-y-1 overflow-y-auto px-3 pt-4'>
        {navItems
          .filter((item) => item.href !== '/inbox' || emailInboxReady)
          .map((item) => {
            const title = t(item.titleKey);
            return (
              <Button
                key={item.href}
                variant='ghost'
                onClick={(): void => handleNavigation(item.href)}
                className={cn(
                  'h-auto w-full cursor-pointer justify-start gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                  isCollapsed && 'justify-center',
                  isActivePath(item.href)
                    ? 'bg-brand/10 text-brand hover:bg-brand/15'
                    : 'text-muted-foreground hover:bg-card-overlay hover:text-foreground',
                )}
                aria-label={title}
                aria-current={isActivePath(item.href) ? 'page' : undefined}
                title={isCollapsed ? title : undefined}>
                <item.icon className='h-5 w-5 shrink-0' />
                {!isCollapsed && <span>{title}</span>}
              </Button>
            );
          })}
      </nav>

      <div className='border-border border-t p-3'>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              className={cn(
                'h-auto w-full cursor-pointer justify-start gap-3 rounded-lg p-2',
                isCollapsed && 'justify-center',
              )}
              title={isCollapsed ? (displayName ?? t('userMenu')) : undefined}>
              <Avatar size='sm'>
                {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName ?? ''} />}
                <AvatarFallback>{getUserInitials(user?.email ?? undefined)}</AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <span className='text-muted-foreground truncate text-sm font-medium'>
                  {displayName}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side='top' align='start' className='w-56'>
            <DropdownMenuItem onClick={(): void => handleNavigation('/settings')}>
              <Settings className='h-4 w-4' />
              {t('settings')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant='destructive' onClick={(): void => void handleLogout()}>
              <LogOut className='h-4 w-4' />
              {tCommon('signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
