import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AutomationPage from '@/app/(dashboard)/automation/page';
const query = vi.hoisted(() => ({
  data: {
    pages: [
      {
        data: [
          {
            id: 'rule',
            name: 'Coffee rule',
            managed_account_id: null as string | null,
            rule_type: 'general',
            is_active: true,
            priority: 1,
            condition_logic: 'and',
            conditions: { raw_text_contains: ['coffee'] },
            actions: { set_category: 'coffee-category' },
          },
        ],
      },
    ],
  },
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/lib/api/queries/automation.queries', () => ({
  useInfiniteAutomationRules: () => query,
}));
vi.mock('@/lib/api/queries/account.queries', () => ({ useAccounts: () => ({ data: [] }) }));
vi.mock('@/lib/api/queries/category.queries', () => ({
  useAllCategories: () => ({
    data: [{ id: 'coffee-category', name: 'Coffee', translations: { en: 'Coffee' } }],
  }),
}));
vi.mock('@/lib/api/mutations/automation.mutations', () => ({
  useToggleAutomationRule: () => ({ mutate: vi.fn() }),
  useDeleteAutomationRule: () => ({ mutateAsync: vi.fn() }),
  useGenerateAccountRules: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/hooks/use-infinite-scroll', () => ({ useInfiniteScroll: () => null }));
vi.mock('@/components/automation/automation-form', () => ({ AutomationForm: () => null }));
vi.mock('@/components/automation/ai-automation-dialog', () => ({ AiAutomationDialog: () => null }));
vi.mock('@/components/shared/confirm-delete-dialog', () => ({ ConfirmDeleteDialog: () => null }));
afterEach(() => {
  cleanup();
  query.isError = false;
  query.data.pages[0].data[0].managed_account_id = null;
});
describe('automation workspace', () => {
  it('names the category action and exposes edit/delete without swiping', () => {
    render(<AutomationPage />);
    expect(screen.getByText('setcategory: Coffee')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'editRule Coffee rule' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'deleteRule Coffee rule' })).toBeInTheDocument();
  });
  it('clears an unsuccessful search without suggesting the library is empty', async () => {
    render(<AutomationPage />);
    await userEvent.type(screen.getByRole('textbox'), 'unmatched');
    expect(screen.getByText('noResultsDescription')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'addFirst' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('reset', { selector: 'button' }));
    expect(screen.getByText('Coffee rule')).toBeInTheDocument();
  });
  it('identifies managed rules and keeps their edits in the account editor', () => {
    query.data.pages[0].data[0].managed_account_id = 'account';
    render(<AutomationPage />);
    expect(screen.getByText('managedRuleDescription')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'editRule Coffee rule' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'deleteRule Coffee rule' })).toBeDisabled();
    expect(screen.getByRole('switch')).toBeDisabled();
  });
});
