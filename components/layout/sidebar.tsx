'use client';

import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useUiStore } from '@/store/ui-store';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ArrowRightLeft,
  Wallet,
  Tags,
  Zap,
  Settings,
  Menu,
  LogOut,
  User,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  const { user, signOut } = useAuth();
  const isCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleCollapsed = useUiStore((state) => state.toggleSidebarCollapsed);

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

  const getInitials = (email: string | undefined): string => {
    if (!email) return 'U';
    const parts = email.split('@')[0].split('.');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  const getDisplayName = (): string => {
    if (!user) return 'User';
    const email = user.email;
    if (!email) return 'User';
    const username = email.split('@')[0];
    return username
      .split('.')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  return (
    <aside
      className={cn(
        'border-border bg-sidebar-bg relative flex h-full flex-col border-r transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64',
        className,
      )}>
      <button
        onClick={toggleCollapsed}
        className='bg-sidebar-bg hover:bg-card-overlay absolute top-11 -right-4 z-50 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-gray-700 shadow-lg transition-all'>
        <Menu className='h-4 w-4 text-gray-400' />
      </button>

      <div className='border-border flex h-16 items-center justify-center border-b px-4'>
        {!isCollapsed && (
          <div className='flex items-center gap-3'>
            <div className='bg-primary flex h-9 w-9 items-center justify-center rounded-xl'>
              <span className='text-primary-foreground text-sm font-bold'>$</span>
            </div>
            <div className='flex flex-col'>
              <span className='text-lg font-semibold text-white'>Spends</span>
              <span className='text-muted-foreground text-xs'>Assistant</span>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className='bg-primary flex h-9 w-9 items-center justify-center rounded-xl'>
            <span className='text-primary-foreground text-sm font-bold'>$</span>
          </div>
        )}
      </div>

      <nav className='flex-1 space-y-1 overflow-y-auto px-3 pt-4'>
        {navItems.map((item) => (
          <button
            key={item.href}
            onClick={(): void => handleNavigation(item.href)}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isCollapsed && 'justify-center',
              isActivePath(item.href)
                ? 'bg-primary text-white'
                : 'text-gray-400 hover:bg-white/5 hover:text-white',
            )}
            title={isCollapsed ? item.title : undefined}>
            <item.icon className='h-5 w-5 shrink-0' />
            {!isCollapsed && <span>{item.title}</span>}
          </button>
        ))}
      </nav>

      <div className='border-border border-t p-3'>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors',
                isCollapsed ? 'justify-center' : 'hover:bg-accent',
              )}>
              <div className='bg-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full'>
                <span className='text-primary-foreground text-sm font-semibold'>
                  {getInitials(user?.email)}
                </span>
              </div>
              {!isCollapsed && (
                <div className='min-w-0 flex-1 text-left'>
                  <p className='truncate text-sm font-medium text-white'>{getDisplayName()}</p>
                  <p className='text-muted-foreground truncate text-xs'>{user?.email}</p>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='border-border/50 bg-card w-56 shadow-xl'>
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className='cursor-pointer'
              onClick={(): void => handleNavigation('/settings')}>
              <User className='mr-2 h-4 w-4' />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className='cursor-pointer'
              onClick={(): void => handleNavigation('/settings')}>
              <Settings className='mr-2 h-4 w-4' />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(): void => void handleLogout()}
              className='cursor-pointer text-red-400'>
              <LogOut className='mr-2 h-4 w-4' />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
