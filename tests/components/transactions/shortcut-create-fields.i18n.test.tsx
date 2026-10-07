import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShortcutCreateFields } from '@/components/transactions/shortcut-create-fields';
import type { Category } from '@/types';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'es',
}));
vi.mock('@/hooks/use-user-settings', () => ({
  useUserSettings: () => ({ data: { hour_format: '24h' } }),
}));

afterEach(cleanup);

describe('forwarded email category review', () => {
  it('shows the Spanish category label for a saved Spanish locale', () => {
    render(
      <ShortcutCreateFields
        draft={{
          type: 'expense',
          amount: '15000.00',
          date: '2026-10-05',
          eventTime: '11:46',
          eventTimeConfirmed: false,
          description: 'Market',
          notes: '',
          accountId: '',
          categoryId: 'groceries',
        }}
        accounts={[]}
        categories={[
          {
            id: 'groceries',
            user_id: 'owner',
            name: 'Groceries',
            slug: 'groceries',
            parent_id: null,
            icon: null,
            color: null,
            created_at: '2026-10-01T00:00:00Z',
            translations: { en: 'Groceries', es: 'Supermercado' },
            type: 'expense',
            is_active: true,
          } as Category,
        ]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'createCategory' })).toHaveTextContent(
      'Supermercado',
    );
  });
});
