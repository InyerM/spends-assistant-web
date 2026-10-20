import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Account } from '@/types';
const { mutateAsync, mutate } = vi.hoisted(() => ({ mutateAsync: vi.fn(), mutate: vi.fn() }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/lib/api/mutations/account.mutations', () => ({
  useEnableAccountCurrency: () => ({ mutateAsync, mutate, isPending: false }),
}));
import { EnableCurrency } from '@/components/accounts/enable-currency';
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('selects the enabled balance even when account refresh removes the setup control before completion', async () => {
  let finish: (account: Account) => void = () => undefined;
  const promise = new Promise<Account>((resolve) => {
    finish = resolve;
  });
  mutateAsync.mockReturnValue(promise);
  const onEnabled = vi.fn();
  const account = { id: 'root', name: 'Bank', currency: 'COP' } as Account;
  const view = render(<EnableCurrency account={account} currency='USD' onEnabled={onEnabled} />);
  fireEvent.click(screen.getByRole('button', { name: 'addCurrency' }));
  fireEvent.click(screen.getByRole('button', { name: 'enableCurrency' }));
  view.unmount();
  const enabled = { ...account, id: 'usd', currency: 'USD', parent_account_id: 'root' };
  await act(async () => {
    finish(enabled);
    await promise;
  });
  expect(onEnabled).toHaveBeenCalledWith(enabled);
});
