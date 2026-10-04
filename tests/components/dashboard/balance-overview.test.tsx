import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BalanceOverview } from '@/components/dashboard/balance-overview';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));
vi.mock('@/lib/api/queries/account.queries', () => ({
  useAccounts: () => ({
    data: [
      {
        id: 'checking',
        name: 'Checking',
        type: 'checking',
        balance: 100,
        currency: 'COP',
        color: null,
      },
    ],
    isLoading: false,
  }),
}));

describe('dashboard account controls', () => {
  it('opens accounts with Space and gives edit controls accessible names', () => {
    const onEditAccount = vi.fn();
    render(<BalanceOverview onEditAccount={onEditAccount} />);
    fireEvent.keyDown(screen.getAllByRole('button', { name: /Checking/ })[0], { key: ' ' });
    expect(push).toHaveBeenCalledWith('/accounts/checking');
    fireEvent.click(screen.getAllByRole('button', { name: 'edit Checking' })[0]);
    expect(onEditAccount).toHaveBeenCalled();
  });
});
