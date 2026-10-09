'use client';

import { useState } from 'react';
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
  Target,
  ChevronDown,
  MessageCircle,
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
import { useSubscription } from '@/hooks/use-subscription';
import { useUsage } from '@/hooks/use-usage';
import { Progress } from '@/components/ui/progress';

interface NavItem {
  titleKey: string;
  href: string;
  icon: LucideIcon;
}

const quickLinks: NavItem[] = [
  { titleKey: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { titleKey: 'transactions', href: '/transactions', icon: ArrowRightLeft },
  { titleKey: 'financialChat', href: '/chat', icon: MessageCircle },
];

const navGroups: { titleKey: string; items: NavItem[] }[] = [
  {
    titleKey: 'reviewGroup',
    items: [
      { titleKey: 'documents', href: '/documents', icon: Files },
      { titleKey: 'emailInbox', href: '/inbox', icon: Mail },
    ],
  },
  {
    titleKey: 'planningGroup',
    items: [
      { titleKey: 'budgets', href: '/budgets', icon: Target },
      { titleKey: 'categories', href: '/categories', icon: Tags },
      { titleKey: 'automation', href: '/automation', icon: Zap },
    ],
  },
  {
    titleKey: 'wealthGroup',
    items: [
      { titleKey: 'accounts', href: '/accounts', icon: Wallet },
      { titleKey: 'investments', href: '/investments', icon: TrendingUp },
      { titleKey: 'loans', href: '/loans', icon: Landmark },
      { titleKey: 'receivables', href: '/receivables', icon: HandCoins },
      { titleKey: 'reliefFunds', href: '/relief-funds', icon: HeartHandshake },
    ],
  },
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
  const [groupOverrides, setGroupOverrides] = useState<Record<string, boolean>>({});
  const { data: subscription } = useSubscription();
  const { data: usage } = useUsage();

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
  const aiUsed = usage?.ai_parses_used;
  const aiLimit = usage?.ai_parses_limit;

  const renderNavItem = (item: NavItem): React.ReactElement => {
    const title = t(item.titleKey);
    return (
      <Button
        key={item.href}
        variant='ghost'
        onClick={(): void => handleNavigation(item.href)}
        className={cn(
          'h-auto w-full cursor-pointer justify-start gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
          isCollapsed && 'justify-center',
          isActivePath(item.href)
            ? 'bg-brand/10 text-brand hover:bg-brand/15'
            : 'text-muted-foreground hover:bg-card-overlay hover:text-foreground',
        )}
        aria-label={title}
        aria-current={isActivePath(item.href) ? 'page' : undefined}
        title={isCollapsed ? title : undefined}>
        <item.icon className='h-5 w-5 shrink-0' />
        {!isCollapsed && <span className='truncate'>{title}</span>}
      </Button>
    );
  };

  return (
    <aside
      className={cn(
        'border-border bg-sidebar-bg relative flex h-full flex-col border-r transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-66',
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
          <AnottoWordmark compact={isCollapsed} animated />
        </div>
      </div>

      <nav
        aria-label={t('primaryNavigation')}
        className='flex-1 space-y-1 overflow-y-auto px-3 py-4'>
        {quickLinks.map(renderNavItem)}
        <div className='border-border my-3 border-t' />
        {navGroups.map((group) => {
          const items = group.items.filter((item) => item.href !== '/inbox' || emailInboxReady);
          const groupStateKey = `${pathname}:${group.titleKey}`;
          const isOpen =
            groupOverrides[groupStateKey] ?? items.some((item) => isActivePath(item.href));
          return (
            <div key={group.titleKey} className='space-y-1'>
              {!isCollapsed && (
                <button
                  type='button'
                  className='text-muted-foreground hover:text-foreground focus-visible:ring-ring flex min-h-9 w-full cursor-pointer items-center justify-between rounded-lg px-3 text-left text-xs font-semibold tracking-wide focus-visible:ring-2 focus-visible:outline-none'
                  aria-expanded={isOpen}
                  onClick={(): void =>
                    setGroupOverrides((current) => ({ ...current, [groupStateKey]: !isOpen }))
                  }>
                  {t(group.titleKey)}
                  <ChevronDown
                    className={cn('h-3.5 w-3.5 transition-transform', !isOpen && '-rotate-90')}
                    aria-hidden='true'
                  />
                </button>
              )}
              {(isCollapsed || isOpen) && (
                <div className='space-y-1'>{items.map(renderNavItem)}</div>
              )}
            </div>
          );
        })}
      </nav>

      {!isCollapsed && subscription && (
        <div className='border-brand-secondary/25 bg-brand-secondary/5 mx-3 mb-3 rounded-2xl border p-3.5'>
          <p className='text-foreground text-sm font-semibold'>
            {t('planLabel')} · {t(subscription.plan === 'pro' ? 'pro' : 'free')}
          </p>
          {subscription.plan === 'pro' ? (
            <p className='text-muted-foreground mt-2 text-xs'>{t('unlimitedAi')}</p>
          ) : typeof aiUsed === 'number' && typeof aiLimit === 'number' && aiLimit > 0 ? (
            <div className='mt-3 space-y-2'>
              <div className='text-muted-foreground flex justify-between text-xs'>
                <span>{t('aiUsage')}</span>
                <span className='text-foreground tabular-nums'>
                  {aiUsed} / {aiLimit}
                </span>
              </div>
              <Progress
                value={Math.min(100, Math.round((aiUsed / aiLimit) * 100))}
                aria-label={t('aiUsage')}
                className='bg-brand-secondary/15 [&_[data-slot=progress-indicator]]:bg-brand-secondary'
              />
            </div>
          ) : null}
          <Button
            variant='outline'
            className='mt-3 h-8 w-full rounded-lg text-xs'
            onClick={(): void => handleNavigation('/settings?tab=subscription')}>
            {t('viewUsage')}
          </Button>
        </div>
      )}

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
