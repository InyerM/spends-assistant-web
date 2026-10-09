import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AutomationRuleExplanation } from '@/components/automation/automation-rule-explanation';
const mock = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('next-intl', () => ({
  useLocale: () => 'es',
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/lib/api/queries/automation-explanation.queries', () => ({
  useAutomationExplanation: mock.query,
}));
const rule = {
  name: 'Coffee',
  conditions: { raw_text_contains: ['coffee'] },
  actions: { add_note: 'Reviewed' },
};
afterEach(cleanup);
describe('automation explanation', () => {
  it('keeps manual create usable and requests explanation only on demand', async () => {
    mock.query.mockReturnValue({
      data: undefined,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<AutomationRuleExplanation rule={rule} />);
    expect(mock.query.mock.calls.at(-1)?.[2]).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'explainRule' }));
    expect(mock.query.mock.calls.at(-1)?.[2]).toBe(true);
  });
  it('preserves prior explanation after draft edits and marks it stale until refreshed', () => {
    mock.query.mockReturnValue({
      data: { explanation: 'Adds a note when coffee matches.' },
      isFetching: false,
      error: null,
    });
    const { rerender } = render(<AutomationRuleExplanation rule={rule} initialRule={rule} />);
    rerender(
      <AutomationRuleExplanation
        rule={{ ...rule, actions: { add_note: 'Changed' } }}
        initialRule={rule}
      />,
    );
    expect(screen.getByText('Adds a note when coffee matches.')).toBeInTheDocument();
    expect(screen.getByText('explanationChanged')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'refreshExplanation' })).toBeInTheDocument();
  });
});
