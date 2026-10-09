import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ChatPage from '@/app/(dashboard)/chat/page';
import type { FinancialChatResponse } from '@/lib/api/mutations/financial-chat.mutations';
const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  response: undefined as FinancialChatResponse | undefined,
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));
vi.mock('@/lib/api/queries/ai-consent.queries', () => ({
  useAiConsent: () => ({ data: { consents: { financial_text: true } } }),
}));
vi.mock('@/lib/api/mutations/financial-chat.mutations', () => ({
  useFinancialChat: () => ({
    mutate: mocks.mutate,
    isPending: false,
    isError: false,
    data: mocks.response,
    reset: vi.fn(),
  }),
}));
describe('financial chat composer', () => {
  afterEach(() => {
    cleanup();
    mocks.response = undefined;
    vi.clearAllMocks();
  });
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
  it('shows a localized context gap without displaying an uncited model answer', () => {
    mocks.response = {
      answer: 'Untrusted unsupported response',
      insufficientContext: true,
      citations: [],
      coverage: {
        month: '2026-10',
        asOf: '2026-10-08',
        truncated: false,
        currencyBasis: 'Original',
        gaps: [],
        counts: { transactions: 1, accounts: 1, documents: 0 },
      },
    };
    render(<ChatPage />);
    expect(screen.getByText('insufficientContext')).toBeVisible();
    expect(screen.queryByText('Untrusted unsupported response')).not.toBeInTheDocument();
    mocks.response = undefined;
  });

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
