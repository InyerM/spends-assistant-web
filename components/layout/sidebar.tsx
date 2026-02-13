'use client';

import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useUiStore } from '@/store/ui-store';
import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, ArrowRightLeft, Wallet, Tags, Zap, Menu, LogOut } from 'lucide-react';

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Transactions', href: '/transactions', icon: ArrowRightLeft },
  { title: 'Accounts', href: '/accounts', icon: Wallet },
  { title: 'Categories', href: '/categories', icon: Tags },
  { title: 'Automation', href: '/automation', icon: Zap },
];

interface SidebarProps {
  className?: string;
  onClose?: () => void;
}

export function Sidebar({ className, onClose }: SidebarProps): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
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

  return (
    <aside
      className={cn(
        'border-border bg-sidebar-bg relative flex h-full flex-col border-r transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64',
        className,
      )}>
      {!onClose && (
        <button
          onClick={toggleCollapsed}
          className='bg-sidebar-bg hover:bg-card-overlay border-border absolute top-11 -right-4 z-50 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border shadow-lg transition-all'>
          <Menu className='text-muted-foreground h-4 w-4' />
        </button>
      )}

      <div className='border-border flex h-16 items-center border-b px-4'>
        <div className={cn('flex items-center gap-3', isCollapsed && 'w-full justify-center')}>
          <div className='bg-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl'>
            <span className='text-primary-foreground text-sm font-bold'>$</span>
          </div>
          {!isCollapsed && (
            <div className='flex flex-col'>
              <span className='text-foreground text-lg font-semibold'>Spends</span>
              <span className='text-muted-foreground text-xs'>Assistant</span>
            </div>
          )}
        </div>
      </div>

      <nav className='flex-1 space-y-1 overflow-y-auto px-3 pt-4'>
        {navItems.map((item) => (
          <button
            key={item.href}
            onClick={(): void => handleNavigation(item.href)}
            className={cn(
              'flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isCollapsed && 'justify-center',
              isActivePath(item.href)
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-card-overlay hover:text-foreground',
            )}
            title={isCollapsed ? item.title : undefined}>
            <item.icon className='h-5 w-5 shrink-0' />
            {!isCollapsed && <span>{item.title}</span>}
          </button>
        ))}
      </nav>

      <div className='border-border border-t p-3'>
        <button
          onClick={(): void => void handleLogout()}
          className={cn(
            'text-muted-foreground hover:bg-card-overlay hover:text-destructive flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors',
            isCollapsed && 'justify-center',
          )}
          title={isCollapsed ? 'Logout' : undefined}>
          <LogOut className='h-5 w-5 shrink-0' />
          {!isCollapsed && <span className='text-sm font-medium'>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
