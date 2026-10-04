import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Transaction } from '@/types';
import { SpendingByCategory } from '@/components/dashboard/spending-by-category';
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import pt from '@/messages/pt.json';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/api/queries/category.queries', () => ({
  useCategories: () => ({
    data: [
      { id: 'food', name: 'Food', slug: 'food', color: '#94b9ff' },
      { id: 'travel', name: 'Travel', slug: 'travel', color: null },
    ],
    isLoading: false,
  }),
}));
vi.mock('recharts', () => {
  const Container = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Container,
    BarChart: Container,
    Bar: Container,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Cell: ({ fill }: { fill: string }) => <span data-testid='category-color' data-color={fill} />,
  };
});

const transactions = [
  { type: 'expense', category_id: null, amount: 50, financial_role: null },
  { type: 'expense', category_id: 'food', amount: 40, financial_role: null },
  { type: 'expense', category_id: 'travel', amount: 30, financial_role: null },
] as Transaction[];

describe('spending by category', () => {
  afterEach(cleanup);
  it.each([
    ['en', en, 'Uncategorized'],
    ['es', es, 'Sin categoría'],
    ['pt', pt, 'Sem categoria'],
  ] as const)(
    'localizes missing categories in %s and preserves distinct category colors',
    (locale, messages, fallback) => {
      render(
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SpendingByCategory transactions={transactions} />
        </NextIntlClientProvider>,
      );

      expect(screen.getByRole('img')).toHaveAccessibleName(expect.stringContaining(fallback));
      const colors = screen.getAllByTestId('category-color').map((cell) => cell.dataset.color);
      expect(colors).toContain('#94b9ff');
      expect(new Set(colors).size).toBe(3);
    },
  );
});
