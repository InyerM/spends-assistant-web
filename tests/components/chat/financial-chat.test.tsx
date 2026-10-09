import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ChatPage from '@/app/(dashboard)/chat/page';
const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/lib/api/queries/ai-consent.queries', () => ({
  useAiConsent: () => ({ data: { consents: { financial_text: true } } }),
}));
vi.mock('@/lib/api/mutations/financial-chat.mutations', () => ({
  useFinancialChat: () => ({
    mutate: mocks.mutate,
    isPending: false,
    isError: false,
    data: undefined,
    reset: vi.fn(),
  }),
}));
describe('financial chat composer', () => {
  beforeEach(() =>
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    ),
  );
  it('requires explicit corpus acknowledgement and a question', () => {
    render(<ChatPage />);
    const send = screen.getByRole('button', { name: 'send' });
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByLabelText('question'), { target: { value: 'What did I spend?' } });
    expect(send).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(send).toBeEnabled();
    fireEvent.click(send);
    expect(mocks.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ question: 'What did I spend?', corpusAcknowledged: true }),
    );
  });
});
